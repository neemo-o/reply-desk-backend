import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConversationsService } from "./conversations.service";
import { ConversationsController } from "./conversations.controller";
import { MESSAGE_QUEUE } from "../queue/queue.module";

@Module({
  imports: [BullModule.registerQueue({ name: MESSAGE_QUEUE })],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
