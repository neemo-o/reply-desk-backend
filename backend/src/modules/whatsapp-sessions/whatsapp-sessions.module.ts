import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { WhatsappSessionsService } from "./whatsapp-sessions.service";
import { WhatsappSessionsController } from "./whatsapp-sessions.controller";
import { WhatsappSessionsProcessor } from "./whatsapp-sessions.processor";
import { SESSION_QUEUE } from "../queue/queue.module";

@Module({
  imports: [BullModule.registerQueue({ name: SESSION_QUEUE })],
  controllers: [WhatsappSessionsController],
  providers: [WhatsappSessionsService, WhatsappSessionsProcessor],
  exports: [WhatsappSessionsService],
})
export class WhatsappSessionsModule {}
