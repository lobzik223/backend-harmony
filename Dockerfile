# syntax=docker/dockerfile:1
# Harmony backend (NestJS + PostgreSQL), Node 20 LTS

# ---- Builder ----
FROM node:20-alpine AS builder

WORKDIR /app

# Уменьшить обрывы при нестабильной сети: таймауты и повторы
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000

COPY package.json package-lock.json ./
COPY prisma ./prisma
# Повтор при ECONNRESET (нестабильная сеть в CI/Docker)
RUN set -e; for i in 1 2 3 4 5; do npm install && break; \
    echo "npm install attempt $i failed, retrying in 30s..."; sleep 30; [ "$i" = 5 ] && exit 1; done

COPY . .
RUN npm run build

# ---- Production ----
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache dumb-init tzdata ca-certificates && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN set -e; for i in 1 2 3 4 5; do npm install --omit=dev && npm cache clean --force && break; \
    echo "npm install (prod) attempt $i failed, retrying in 30s..."; sleep 30; [ "$i" = 5 ] && exit 1; done
RUN set -e; for i in 1 2 3 4 5; do npm install prisma@6 --no-save && break; \
    echo "prisma install attempt $i failed, retrying in 30s..."; sleep 30; [ "$i" = 5 ] && exit 1; done

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY scripts ./scripts
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

RUN chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=512"

HEALTHCHECK --interval=30s --timeout=5s --start-period=35s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/health', (r) => { r.resume(); process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--", "/app/docker-entrypoint.sh"]
