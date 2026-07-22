import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { MessageProcessor } from './message.processor';
import { MESSAGE_QUEUE } from '../queue/queue.module';

/**
 * 📈 E6 — ConversationsModule registra MessageProcessor.
 * No processo HTTP, o processor é inerte (sem WorkerHost ativo).
 * No processo worker (worker.ts), ele consome a fila.
 */
@Module({
  imports: [BullModule.registerQueue({ name: MESSAGE_QUEUE })],
  controllers: [ConversationsController],
  providers: [ConversationsService, MessageProcessor],
  exports: [ConversationsService],
})
export class ConversationsModule {}
