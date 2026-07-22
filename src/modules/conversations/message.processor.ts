import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { MESSAGE_QUEUE } from '../queue/queue.module';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * 📈 E6 — MessageProcessor: consome a fila 'messages' para envio assíncrono.
 *
 * Cada job `send-message` contém { messageId, tenantId }.
 * O processor:
 * 1. Busca a message + conversation + session no DB
 * 2. Chama Evolution API para enviar (TODO)
 * 3. Atualiza message.status para 'sent' ou 'failed'
 *
 * Roda DENTRO do processo worker (worker.ts).
 */
@Processor(MESSAGE_QUEUE, { concurrency: 5 })
export class MessageProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ messageId: string; tenantId: string }>) {
    this.logger.log(`[job=${job.id}] Enviando mensagem ${job.data.messageId}`);

    try {
      // Busca a mensagem com conversation para ter o contato + session.
      const message = await this.prisma.message.findUnique({
        where: { id: job.data.messageId },
        include: {
          conversation: {
            select: {
              id: true,
              contactId: true,
              sessionId: true,
              session: { select: { sessionName: true, evolutionInstanceId: true, status: true } },
            },
          },
        },
      });

      if (!message) {
        this.logger.warn(`[job=${job.id}] Mensagem ${job.data.messageId} não encontrada`);
        return; // Job não tem o que processar — não fazer retry.
      }

      // TODO: Chamar Evolution API para enviar a mensagem.
      // Por enquanto, simula sucesso e marca como 'sent'.
      await this.prisma.message.update({
        where: { id: message.id },
        data: { status: 'sent' },
      });

      this.logger.log(`[job=${job.id}] Mensagem ${message.id} → sent`);
    } catch (err) {
      this.logger.error(
        `[job=${job.id}] Falha ao enviar mensagem ${job.data.messageId}: ${(err as Error).message}`,
      );
      // Marcar como 'failed' no DB se esgotou tentativas.
      const attempts = job.opts.attempts ?? 1;
      if (job.attemptsMade >= attempts - 1) {
        await this.prisma.message.update({
          where: { id: job.data.messageId },
          data: { status: 'failed' },
        }).catch(() => void 0); // Silencioso — melhor esforço.
      }
      throw err;
    }
  }
}
