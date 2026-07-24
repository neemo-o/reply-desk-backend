import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';

/**
 * ♻️ Cleanup de tenants bloqueados há mais de 30 dias sem retomar.
 *
 * Quando uma subscription entra em past_due ou cancelled, o tenant fica
 * bloqueado (SubscriptionGuard impede acesso). O usuário pode retomar
 * a qualquer momento fazendo um novo checkout. Porém, se passar 30 dias
 * sem retomar, o tenant e todos os dados relacionados são deletados
 * (cascade) para não acumular dados inúteis no banco.
 *
 * Roda a cada 6 horas. Considera o updatedAt da subscription — se o
 * usuário fez um novo checkout (updatedAt mudou), o timer reseta.
 */
@Injectable()
export class BlockedTenantCleanupJob implements OnModuleInit {
  private readonly logger = new Logger(BlockedTenantCleanupJob.name);
  private readonly prisma = new PrismaClient();

  async onModuleInit() {
    await this.prisma.$connect();
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async run() {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);

      // Encontra subscriptions em past_due ou cancelled há mais de 30 dias
      // (updatedAt < cutoff significa que ninguém mexeu na subscription
      //  — nem novo checkout, nem webhook — nos últimos 30 dias)
      const blockedSubs = await this.prisma.subscription.findMany({
        where: {
          status: { in: ['past_due', 'cancelled'] },
          updatedAt: { lt: cutoff },
        },
        select: { tenantId: true, id: true, status: true, updatedAt: true },
      });

      if (blockedSubs.length === 0) return;

      // Coleta os tenantIds únicos
      const tenantIds = [...new Set(blockedSubs.map((s) => s.tenantId))];

      // Antes de deletar, verifica se algum desses tenants não tem outra
      // subscription ativa/trialing/pending (safety: pode ter renovado)
      const tenantsWithActiveSub = await this.prisma.subscription.findMany({
        where: {
          tenantId: { in: tenantIds },
          status: { in: ['active', 'trialing', 'pending'] },
        },
        select: { tenantId: true },
      });
      const activeTenantIds = new Set(tenantsWithActiveSub.map((s) => s.tenantId));

      // Filtra apenas tenants que NÃO têm nenhuma subscription válida
      const tenantsToDelete = tenantIds.filter((id) => !activeTenantIds.has(id));

      if (tenantsToDelete.length === 0) return;

      // Deleta os tenants — cascade remove subscriptions, sessions, bots,
      // contacts, conversations, webhooks, etc (definido no schema.prisma)
      const result = await this.prisma.tenant.deleteMany({
        where: { id: { in: tenantsToDelete } },
      });

      this.logger.log(
        `Cleanup de tenants bloqueados: ${result.count} tenant(s) removidos ` +
        `(estavam em past_due/cancelled há mais de 30 dias sem retomar)`,
      );

      // Loga quais tenants foram deletados para auditoria
      for (const tenantId of tenantsToDelete) {
        this.logger.log(`Tenant ${tenantId} deletado (inativo >30 dias)`);
      }
    } catch (err) {
      this.logger.error('Falha no cleanup de tenants bloqueados', err as Error);
    }
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
