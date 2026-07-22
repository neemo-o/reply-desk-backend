import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

export const SESSION_QUEUE = 'whatsapp-sessions';
export const MESSAGE_QUEUE = 'messages';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: SESSION_QUEUE }, { name: MESSAGE_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
