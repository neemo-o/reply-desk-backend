import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from './worker.module';

/**
 * 📈 E1 — Worker BullMQ em processo separado da API HTTP.
 *
 * Este processo consome filas BullMQ (whatsapp-sessions, messages) sem
 * competir com o event loop da API. Pode ser escalado horizontalmente
 * (k8s replicas) independentemente da API.
 *
 * Inicia: `npm run start:worker` ou `node dist/worker.js`
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  // Graceful shutdown — BullMQ workerHost fecha limpo no SIGTERM.
  app.enableShutdownHooks();
  process.on('SIGTERM', () => {
    app
      .close()
      .catch((err) => console.error('[SIGTERM] worker shutdown error', err))
      .finally(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    app
      .close()
      .catch(() => process.exit(0))
      .finally(() => process.exit(0));
  });

  console.log('[Worker] BullMQ worker iniciado — consumindo filas...');
}

bootstrap();
