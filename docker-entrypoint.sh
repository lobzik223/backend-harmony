#!/bin/sh
set -e
cd /app

# Папки для загрузок (том uploads может быть с правами root — создаём и отдаём nestjs)
mkdir -p uploads/covers uploads/tracks uploads/articles
chown -R 1001:1001 uploads 2>/dev/null || true

# Миграции при каждом старте/пересборке (идемпотентно)
if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] Running prisma migrate deploy..."
  npx prisma migrate deploy
  echo "[entrypoint] Migrations done."
fi

# Запуск от пользователя nestjs (uid 1001), если мы root
if [ "$(id -u)" = "0" ]; then
  exec su-exec nestjs node dist/main.js
fi
exec node dist/main.js
