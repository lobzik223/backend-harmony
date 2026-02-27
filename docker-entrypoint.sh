#!/bin/sh
set -e
cd /app
mkdir -p uploads/covers uploads/tracks uploads/articles
if [ -n "$DATABASE_URL" ]; then
  npx prisma migrate deploy
fi
exec node dist/main.js
