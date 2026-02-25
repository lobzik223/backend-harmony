#!/bin/sh
set -e
cd /app
if [ -n "$DATABASE_URL" ]; then
  npx prisma migrate deploy
fi
exec node dist/main.js
