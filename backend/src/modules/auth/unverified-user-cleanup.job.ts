import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';

/**
 * ♻️ E2 — Limpa usuários não verificados com mais de 7 dias.
 *
 * Usuários que registram mas nunca confirmam o email ficam acumulando no banco.
 * Este job remove usuários com emailVerified=false E createdAt > 7 dias, junto
 * com seus refresh tokens (cascade). TenantUsers não são afetados porque um
 * usuário não verificado nunca cria tenant.
 *
 * Roda a cada 6 horas. Em alta escala, mover para um BullMQ job em vez de cron.
 */
@Injectable()
export class UnverifiedUserCleanupJob implements OnModuleInit {
  private readonly logger = new Logger(UnverifiedUserCleanupJob.name);
  private readonly prisma = new PrismaClient();

  async onModuleInit() {
    await this.prisma.$connect();
  }

  // A cada 6 horas — mesmo cadência do refresh-token-cleanup
  @Cron(CronExpression.EVERY_6_HOURS)
  async run() {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);

      // Usuários não verificados há mais de 7 dias, sem tenant_users (never onboarded)
      const result = await this.prisma.user.deleteMany({
        where: {
          emailVerified: false,
          createdAt: { lt: cutoff },
          tenantUsers: { none: {} },
        },
      });

      if (result.count > 0) {
        this.logger.log(`Limpeza de usuários não verificados: ${result.count} registros removidos`);
      }
    } catch (err) {
      this.logger.error('Falha na limpeza de usuários não verificados', err as Error);
    }
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
