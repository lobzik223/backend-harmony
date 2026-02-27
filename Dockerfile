# syntax=docker/dockerfile:1
# Harmony backend (NestJS + PostgreSQL), Node 20 LTS

# ---- Builder ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm install

COPY . .
RUN npm run build

# ---- Production ----
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache dumb-init tzdata ca-certificates && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm install --omit=dev && npm cache clean --force
RUN npm install prisma@6 --no-save

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
