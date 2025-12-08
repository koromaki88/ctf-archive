FROM python:3.12-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy project files
COPY pyproject.toml uv.lock ./
COPY manage.py ./
COPY src/ ./src/

# Install dependencies (production only, exclude dev tools like ruff)
RUN uv sync --frozen --no-dev

# Expose port
EXPOSE 8000

# Set Python path so uvicorn can find the config module
ENV PYTHONPATH=/app/src

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/healthz')"

# Run migrations, seed data, and start production server with uvicorn
# 4 workers for ~200 concurrent users (50 connections per worker)
CMD uv run python manage.py migrate && \
    uv run python manage.py seed_data && \
    uv run uvicorn config.asgi:application \
      --host 0.0.0.0 \
      --port 8000 \
      --workers 4 \
      --log-level info

