import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true, // 🔒 Stripe webhook precisa do raw body para validar a assinatura
  });

  app.useLogger(app.get(Logger));

  // 🔒 S1 — CORS whitelist (env-driven, fail-closed)
  const rawOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const isWildcard = rawOrigins.includes('*');
  app.enableCors({
    origin: isWildcard
      ? true
      : rawOrigins.length
        ? rawOrigins
        : false, // false = bloqueia tudo se não configurado
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
    maxAge: 600,
  });

  // 🛡️ S11 — Helmet com CSP reforçada para API JSON
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'none'"],
          'frame-ancestors': ["'none'"],
          'base-uri': ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 🚦 E2 — Graceful shutdown (Prisma + BullMQ + Redis)
  app.enableShutdownHooks();
  process.on('SIGTERM', () => {
    app
      .close()
      .catch((err) => console.error('[SIGTERM] graceful shutdown error', err))
      .finally(() => process.exit(0));
  });

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
