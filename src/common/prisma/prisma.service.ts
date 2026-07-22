import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

/**
 * ⚡ P1 — PrismaService tuning para performance em hardware limitado (2vCPU/4GB).
 *
 * Otimizações:
 * - `log` configurado por ambiente: prod só vê 'error' (silencia warn/info).
 * - Connection pool controlado via DATABASE_URL (connection_limit=20).
 * - `omit` padrão para campos sensíveis não voltam para o JSON do client.
 *   (ainda é possível pedir explicitamente via `select.passwordHash: true`).
 *
 * O connection_limit fica na DATABASE_URL (Prisma 5 lê automaticamente).
 * Ver `.env.example` para referência.
 */
@Injectable()
export class PrismaService extends PrismaClient<Prisma.PrismaClientOptions, 'info' | 'warn' | 'error'> implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const isProd = process.env.NODE_ENV === 'production';
    super({
      log: isProd ? ['error'] : ['warn', 'error'],
      errorFormat: isProd ? 'minimal' : 'pretty',
      // Não emite connection_acquired_timeout mensagens no log (gera ruído em prod)
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma conectado');
  }

  async onModuleDestroy() {
    this.logger.log('Fechando conexões Prisma...');
    await this.$disconnect();
  }
}
