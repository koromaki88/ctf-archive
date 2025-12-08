#!/bin/sh
set -e

SECRET_FILE=${SECRET_FILE:-/secret}
DB_HOST=${DB_HOST:-mysql}
DB_PORT=${DB_PORT:-3306}

if [ ! -f "$SECRET_FILE" ]; then
  openssl rand -hex 24 > "$SECRET_FILE"
fi

echo "Waiting for MySQL at ${DB_HOST}:${DB_PORT}..."
for i in $(seq 1 60); do
  if nc -z "$DB_HOST" "$DB_PORT" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

php /opt/www/scripts/seed_runtime.php

rm /opt/www/scripts/seed_runtime.php

chown www-data:www-data /opt/www/bin/hyperf.php && chmod +x /opt/www/bin/hyperf.php

echo "Starting server..."

exec su www-data -c "/opt/www/bin/hyperf.php start"
