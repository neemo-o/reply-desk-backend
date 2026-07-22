import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { SESSION_QUEUE } from '../queue/queue.module';
import { WhatsappSessionsService } from './whatsapp-sessions.service';

/**
 * 📈 E5 — Processor refinado com error handling + log estruturado.
 *
 * Roda DENTRO do processo worker (worker.ts), não no processo HTTP.
 * Usa @Processor com concurrency limitada para não saturar Evolution API.
 */
@Processor(SESSION_QUEUE, { concurrency: 3 })
export class WhatsappSessionsProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsappSessionsProcessor.name);

  constructor(private readonly sessionsService: WhatsappSessionsService) {
    super();
  }

  async process(job: Job<{ sessionId: string; tenantId?: string }>) {
    this.logger.log(`[job=${job.id}] Conectando sessão ${job.data.sessionId}`);

    try {
      if (job.name === 'connect-session') {
        // TODO: chamar Evolution API para criar instância e obter QR code.
        // Por enquanto, apenas atualiza status para 'qrcode_pending'.
        await this.sessionsService.updateStatus(job.data.sessionId, 'qrcode_pending');
        this.logger.log(`[job=${job.id}] Sessão ${job.data.sessionId} → qrcode_pending`);
      } else if (job.name === 'disconnect-session') {
        // TODO: chamar Evolution API para desconectar instância.
        await this.sessionsService.updateStatus(job.data.sessionId, 'disconnected');
        this.logger.log(`[job=${job.id}] Sessão ${job.data.sessionId} → disconnected`);
      } else {
        this.logger.warn(`[job=${job.id}] Job name desconhecido: ${job.name}`);
      }
    } catch (err) {
      this.logger.error(
        `[job=${job.id}] Falha ao processar sessão ${job.data.sessionId}: ${(err as Error).message}`,
      );
      // BullMQ vai fazer retry automaticamente (configurado no controller: attempts=3).
      throw err;
    }
  }
}
