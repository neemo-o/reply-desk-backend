import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';

/**
 * ♻️ S5 — Limpa refresh tokens expirados ou revogados.
 *
 * Mantém a tabela refresh_tokens em tamanho controlado e remove material
 * sensível (hashes argon2) prontos para cracking offline após exfiltração.
 *
 * Requer: `@nestjs/schedule` em package.json. Se ainda não estiver instalado,
 * este módulo simplesmente não é registrado no AppModule — ver app.module.ts.
 */
@Injectable()
export class RefreshTokenCleanupJob implements OnModuleInit {
  private readonly logger = new Logger(RefreshTokenCleanupJob.name);
  private readonly prisma = new PrismaClient();

  async onModuleInit() {
    await this.prisma.$connect();
  }

  // A cada 6 horas
  @Cron(CronExpression.EVERY_6_HOURS)
  async run() {
    try {
      const cutoff = new Date();
      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { revoked: true },
            { expiresAt: { lt: cutoff } },
          ],
        },
      });
      if (result.count > 0) {
        this.logger.log(`Limpeza de refresh_tokens: ${result.count} registros removidos`);
      }
    } catch (err) {
      this.logger.error('Falha na limpeza de refresh_tokens', err as Error);
    }
  }

  // Para evitar leak de timer — será chamado em graceful shutdown via AppModule.
  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
