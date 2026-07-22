import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { SESSION_QUEUE } from '../queue/queue.module';
import { WhatsappSessionsService } from './whatsapp-sessions.service';

@Processor(SESSION_QUEUE)
export class WhatsappSessionsProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsappSessionsProcessor.name);

  constructor(private readonly sessionsService: WhatsappSessionsService) {
    super();
  }

  async process(job: Job<{ sessionId: string }>) {
    if (job.name === 'connect-session') {
      this.logger.log(`Conectando sessão ${job.data.sessionId} via Evolution API`);
      // TODO: chamar Evolution API para criar instância e obter QR code
      await this.sessionsService.updateStatus(job.data.sessionId, 'qrcode_pending');
    }
  }
}
