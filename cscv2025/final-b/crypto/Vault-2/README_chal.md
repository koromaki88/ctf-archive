# CTF Challenge - Production Deployment

## Architecture

This deployment uses a production-ready stack optimized for 200 concurrent players over 8 hours:

- **Uvicorn ASGI Server**: 4 workers (~50 connections each = 200 total)
- **PostgreSQL 16**: Persistent database with connection pooling
- **Redis 7**: Session storage and caching (reduces DB load)
- **Django 5.0**: Backend framework with DRF

## Quick Deployment

### 1. Configure Environment

Copy the example environment file and update all `REPLACE_ME` values:

```bash
cp .env.example .env
nano .env  # or use your preferred editor
```

**Critical secrets to update:**
- `CTF_SECRET_KEY` - Django secret key (50+ chars)
- `CTF_MANAGER_SECRET_KEY` - Used for JWT signing and ECDSA (64 char hex)
- `CTF_TENANT_SALT` - Tenant derivation salt (32 char hex)
- `POSTGRES_PASSWORD` - Database password (16+ chars)
- `CTF_SEED_MANAGER_PASSWORD` - Manager account password
- `CTF_SEED_BOB_SECRET` - Stage 2 flag value
- `CTF_SEED_MANAGER_ESCROW_SECRET` - Stage 1 flag value

**Generate secrets:**
```bash
# Django SECRET_KEY
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# MANAGER_SECRET_KEY (64 char hex)
python -c "import secrets; print(secrets.token_hex(32))"

# TENANT_SALT (32 char hex)
python -c "import secrets; print(secrets.token_hex(16))"
```

### 2. Build and Deploy

```bash
chmod +x build.sh
./build.sh
```

This will:
1. Build all Docker images
2. Start PostgreSQL and Redis services
3. Start backend with 4 uvicorn workers
4. Run database migrations
5. Seed privileged accounts (manager1, manager2)

### 3. Verify Deployment

```bash
# Check all services are running
docker-compose ps

# View logs
docker-compose logs -f ctf-backend

# Test health endpoint
curl http://localhost:8000/healthz
```

## Service Management

### Basic Operations

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart backend only
docker-compose restart ctf-backend

# View logs (all services)
docker-compose logs -f

# View backend logs only
docker-compose logs -f ctf-backend
```

### Scaling Considerations

**Current Configuration (200 players):**
- 4 uvicorn workers
- PostgreSQL connection pool: 600s
- Redis max memory: 256MB
- Recommended resources:
  - CPU: 4 cores
  - RAM: 2GB (1GB backend + 512MB PostgreSQL + 256MB Redis + overhead)
  - Disk: 10GB

**To scale up for more players:**
- Increase uvicorn workers: Edit `Dockerfile` CMD line
- Increase Redis memory: Edit `docker-compose.yml` redis command
- Add more backend containers: Use docker-compose scaling

## Default Accounts

After seeding, these accounts are available:

- **manager1** / `<CTF_SEED_MANAGER_PASSWORD>` (MANAGER role)
- **manager2** / `<CTF_SEED_MANAGER_PASSWORD>` (MANAGER role)

## API Endpoints

- **Health Check**: `GET /healthz` - Service health status
- **Authentication**: `POST /api/auth/register`, `POST /api/auth/login`
- **User Profile**: `GET /api/me`
- **Vault**: `/api/vault/*` - Vault operations
- **Admin**: `http://localhost:8000/admin/` (if enabled)

## Troubleshooting

### Services won't start

```bash
# Check service health
docker-compose ps

# View specific service logs
docker-compose logs postgres
docker-compose logs redis
docker-compose logs ctf-backend

# Restart all services
docker-compose down && docker-compose up -d
```

### Database connection errors

```bash
# Check PostgreSQL is ready
docker-compose exec postgres pg_isready -U ctf_user

# Check database connectivity
docker-compose exec ctf-backend uv run python manage.py dbshell
```

### Redis connection errors

```bash
# Check Redis is responding
docker-compose exec redis redis-cli ping

# Should respond with: PONG
```

### Backend crashes or errors

```bash
# Check environment variables are set
docker-compose exec ctf-backend env | grep CTF_

# Run migrations manually
docker-compose exec ctf-backend uv run python manage.py migrate

# Check for secret validation errors (placeholder values)
docker-compose logs ctf-backend | grep "ImproperlyConfigured"
```

### Performance issues

```bash
# Monitor resource usage
docker stats

# Check worker processes
docker-compose exec ctf-backend ps aux | grep uvicorn

# Check PostgreSQL connections
docker-compose exec postgres psql -U ctf_user -d ctf_backend -c "SELECT count(*) FROM pg_stat_activity;"

# Check Redis memory usage
docker-compose exec redis redis-cli info memory
```

## Backup and Recovery

### Database Backup

```bash
# Create backup
docker-compose exec postgres pg_dump -U ctf_user ctf_backend > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U ctf_user ctf_backend < backup.sql
```

### Complete Data Backup

```bash
# Backup all volumes
docker-compose down
docker run --rm -v private_postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .
docker run --rm -v private_redis-data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz -C /data .
docker-compose up -d
```

## Security Notes

1. **Never commit `.env` file** - It contains secrets and flags
2. **Change all default passwords** - Use the password generators above
3. **Restrict ALLOWED_HOSTS** - Set to your actual domain in production
4. **Set DEBUG=false** - Always disable debug mode in production
5. **Use HTTPS** - Consider adding Nginx with TLS if exposing publicly
6. **Monitor logs** - Watch for suspicious activity or exploits
7. **Regular backups** - Backup database before and after the CTF

## Performance Characteristics

**Uvicorn Workers (4):**
- Each worker: ~50 concurrent connections
- Total capacity: ~200 concurrent users
- Response time: <100ms for typical requests

**PostgreSQL:**
- Connection pooling: 600 seconds (CONN_MAX_AGE)
- Concurrent connections: 200+ supported
- Query performance: Indexed for all lookup patterns

**Redis:**
- Session storage: ~50KB per user = ~10MB for 200 users
- Cache hit ratio: >90% for repeated requests
- Memory limit: 256MB (more than sufficient)

**Expected Resource Usage:**
- CPU: 40-60% on 4 cores under load
- Memory: 1.5GB total (0.8GB backend, 0.4GB PostgreSQL, 0.2GB Redis)
- Network: ~10MB/s peak during heavy load
- Disk I/O: Minimal (mostly sequential writes)

## Rate Limiting

The system implements **CTF-friendly rate limiting** with generous limits that allow legitimate solving while preventing abuse:

### Rate Limit Values

| Endpoint | Limit | Reference Exploit | Headroom |
|----------|-------|------------------|----------|
| Session creation | 200/hour | 48 requests | 4.2x |
| Secret storage | 100/hour | 20 requests | 5x |
| Secret retrieval | 300/hour | 48 requests | 6.3x |
| Signature collection | 300/hour | 47 requests | 6.4x |
| Attestation requests | 200/hour | varies | generous |
| Login attempts | 30/hour | 1 request | 30x |
| Registration | 10/hour per IP | 1 request | 10x |

### Monitoring Rate Limits

```bash
# Watch for 429 (rate limited) responses
docker-compose logs -f ctf-backend | grep "429"

# Check Redis throttle keys
docker-compose exec redis redis-cli --scan --pattern "throttle*" | wc -l

# View rate limit headers in responses
curl -i http://localhost:8000/api/vault/session \
  -H "Authorization: Bearer YOUR_TOKEN"
# Look for: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
```

### Emergency Override

If rate limits need to be disabled during the competition:

```bash
# Method 1: Update .env and restart
echo "CTF_RATE_LIMIT_ENABLED=false" >> .env
docker-compose restart ctf-backend

# Method 2: Temporary override (lost on restart)
docker-compose exec ctf-backend sh -c "export CTF_RATE_LIMIT_ENABLED=false"
```

### Rate Limit Design

- **6x headroom** over reference exploit requirements
- **Network delays** and retries are accommodated
- **Different approaches** won't hit limits
- **Only blocks obvious abuse** (spam/DoS)
- **Helpful headers** show remaining quota

## Competition Duration

The system is configured for an 8-hour CTF competition:
- Vault sessions expire after 1 hour (configurable)
- JWT tokens expire after 30 minutes
- Database connections persist for 10 minutes
- Services automatically restart on failure

## Contact and Support

For issues during deployment, check:
1. Docker logs: `docker-compose logs -f`
2. Environment configuration: Verify all secrets are set
3. Service health: `docker-compose ps`
4. Port conflicts: Ensure port 8000 is available
