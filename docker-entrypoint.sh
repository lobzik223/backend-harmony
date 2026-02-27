#!/bin/sh
set -e
cd /app

# Папки для загрузок
mkdir -p uploads/covers uploads/tracks uploads/articles

# Миграции при каждом старте/пересборке (идемпотентно)
if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] Running prisma migrate deploy..."
  npx prisma migrate deploy
  echo "[entrypoint] Migrations done."
fi

exec node dist/main.js
