import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import express from 'express';
import { json, urlencoded } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import { env } from './config/env.validation';

/** Лимит размера тела запроса — защита от переполнения памяти и DoS */
const BODY_LIMIT = '100kb';

async function bootstrap() {
  const corsOrigins =
    env.CORS_ORIGIN === '*'
      ? true
      : [...env.CORS_ORIGIN.split(',').map((o) => o.trim())].filter(Boolean);

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Harmony-App-Key', 'X-Harmony-Site-Key'],
    },
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      hsts: { maxAge: 31536000, includeSubDomains: true },
      noSniff: true,
      xssFilter: true,
    }),
  );

  app.use(json({ limit: BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_LIMIT }));

  const prefix = env.API_PREFIX.replace(/^\//, '');
  const adminLoginPath = `/${prefix}/admin/login`;

  // Убираем хвостовой слэш у POST /api/admin/login, чтобы Nest точно нашёл маршрут
  app.use((req: any, res: any, next: any) => {
    const path = (req?.originalUrl || req?.url || '').split('?')[0].replace(/\/$/, '') || '/';
    if (req.method === 'POST' && (path === adminLoginPath || path === `${adminLoginPath}/`)) {
      req.url = adminLoginPath + (req.url?.includes('?') ? '?' + (req.originalUrl || req.url).split('?')[1] : '');
    }
    next();
  });

  if (env.APP_KEY) {
    app.use((req: any, res: any, next: any) => {
      const reqPath = (req?.originalUrl || req?.url || '').split('?')[0].replace(/\/$/, '') || '/';
      const healthPath = `/${prefix}/health`;
      const paymentsPath = `/${prefix}/payments`;

      if (reqPath.startsWith('/uploads') && req.method === 'GET') return next();
      if (reqPath.startsWith(healthPath) && req.method === 'GET') return next();
      if (reqPath === adminLoginPath && req.method === 'POST') return next();
      if (reqPath === `${healthPath}/maintenance` && req.method === 'POST') {
        const key = req.headers['x-harmony-app-key'];
        if (key === env.APP_KEY) return next();
        return res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
      }
      if (reqPath.startsWith(healthPath)) return next();
      if (reqPath.startsWith(paymentsPath)) return next();

      const key = req.headers['x-harmony-app-key'];
      if (key !== env.APP_KEY) {
        return res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
      }
      return next();
    });
  }

  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      skipMissingProperties: true,
    }),
  );

  app.setGlobalPrefix(prefix);

  await app.listen(env.PORT, '0.0.0.0');
  const logger = new Logger('bootstrap');
  logger.log(`Harmony backend listening on :${env.PORT}/${prefix}`);
}

void bootstrap();
