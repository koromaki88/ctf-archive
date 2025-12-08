#!/bin/bash
set -e

echo "=========================================="
echo "🚀 CTF Challenge Deployment Script"
echo "=========================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ ERROR: .env file not found!"
    echo "📝 Please copy .env.example to .env and configure it:"
    echo "   cp .env.example .env"
    echo "   nano .env  # Edit and replace REPLACE_ME values"
    exit 1
fi

# Check for placeholder values
if grep -q "REPLACE_ME" .env 2>/dev/null; then
    echo "⚠️  WARNING: .env contains REPLACE_ME placeholders!"
    echo "📝 Please update all REPLACE_ME values in .env before deploying"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "📦 Stopping existing containers..."
docker-compose down -v 2>/dev/null || true

echo ""
echo "🔨 Building Docker images (this may take a few minutes)..."
docker-compose build --no-cache

echo ""
echo "🚀 Starting services (PostgreSQL, Redis, Backend)..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to become healthy..."
sleep 5

# Wait for backend to be healthy (max 60 seconds)
echo "   Checking backend health..."
for i in {1..12}; do
    if docker-compose exec -T ctf-backend python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/healthz', timeout=5)" 2>/dev/null; then
        echo "   ✅ Backend is healthy!"
        break
    fi
    if [ $i -eq 12 ]; then
        echo "   ⚠️  Backend health check timeout. Check logs with: docker-compose logs ctf-backend"
    else
        echo "   ⏳ Waiting... ($i/12)"
        sleep 5
    fi
done

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "📊 Service Status:"
docker-compose ps
echo ""
echo "🌐 Access Points:"
echo "   Health Check: http://localhost:8000/healthz"
echo "   API Base:     http://localhost:8000/api/"
echo "   Admin Panel:  http://localhost:8000/admin/"
echo ""
echo "👤 Default Accounts:"
echo "   manager1 / <CTF_SEED_MANAGER_PASSWORD>"
echo "   manager2 / <CTF_SEED_MANAGER_PASSWORD>"
echo ""
echo "📋 Useful Commands:"
echo "   View logs:        docker-compose logs -f"
echo "   Stop services:    docker-compose down"
echo "   Restart backend:  docker-compose restart ctf-backend"
echo "   Shell access:     docker-compose exec ctf-backend sh"
echo ""
echo "🔧 Troubleshooting:"
echo "   Check logs:       docker-compose logs ctf-backend"
echo "   Check DB:         docker-compose logs postgres"
echo "   Check Redis:      docker-compose logs redis"
echo ""

