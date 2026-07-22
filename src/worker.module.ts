import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { LoggerModule } from './common/logger/logger.module';
import { QueueModule } from './modules/queue/queue.module';
import { WhatsappSessionsModule } from './modules/whatsapp-sessions/whatsapp-sessions.module';
import { ConversationsModule } from './modules/conversations/conversations.module';

/**
 * 📈 E1 — WorkerModule: contexto NestJS para o processo worker.
 *
 * Importa apenas módulos necessários para consumir filas:
 * - QueueModule (BullMQ setup + queues)
 * - WhatsappSessionsModule (SessionProcessor)
 * - ConversationsModule (MessageProcessor)
 *
 * NOTA: controllers NÃO são importados — worker não serve HTTP.
 * NOTA: throttler/JWT/CORS não são necessários aqui.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate }),
    ScheduleModule.forRoot(),
    LoggerModule,
    PrismaModule,
    RedisModule,
    QueueModule,
    WhatsappSessionsModule, // contém WhatsappSessionsProcessor
    ConversationsModule,    // contém ConversationsService (para MessageProcessor)
  ],
})
export class WorkerModule {}
