import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBotDto } from './dto/create-bot.dto';
import { CreateBotRuleDto } from './dto/create-bot-rule.dto';
import { isUuid } from '../../common/utils/security';

@Injectable()
export class BotsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateBotDto) {
    return this.prisma.$transaction(async (tx) => {
      const bot = await tx.bot.create({ data: { tenantId, ...dto } });
      await tx.botVersion.create({ data: { botId: bot.id, version: 1 } });
      return bot;
    });
  }

  /**
   * ⚡ P4 — findAll sem N+1.
   *
   * Cada bot já vem com a versão publicada inline (1 query única com JOIN).
   * Sem rules aqui — UI lista cards de bot, não renderiza regras.
   * Para o painel detalhado, `findOne` traz regras.
   */
  findAll(tenantId: string) {
    return this.prisma.bot.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        defaultVersion: true,
        updatedAt: true,
        createdAt: true,
        versions: {
          where: { published: true },
          orderBy: { version: 'desc' },
          take: 1,
          select: { id: true, version: true, published: true },
        },
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    if (!isUuid(id)) throw new NotFoundException('Bot não encontrado');
    const bot = await this.prisma.bot.findFirst({
      where: { id, tenantId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          include: {
            rules: { orderBy: { priority: 'desc' } },
            variables: true,
          },
        },
      },
    });
    if (!bot) throw new NotFoundException('Bot não encontrado');
    return bot;
  }

  async addRule(tenantId: string, botId: string, versionNumber: number, dto: CreateBotRuleDto) {
    await this.findOne(tenantId, botId);

    const botVersion = await this.prisma.botVersion.findFirst({
      where: { botId, version: versionNumber },
      select: { id: true },
    });
    if (!botVersion) throw new NotFoundException('Versão do bot não encontrada');

    return this.prisma.botRule.create({
      data: { ...dto, botVersionId: botVersion.id },
    });
  }

  /**
   * ⚡ E6/D2 — Envolvido em transação atômica.
   */
  async publish(tenantId: string, botId: string, versionNumber: number) {
    await this.findOne(tenantId, botId);

    return this.prisma.$transaction(async (tx) => {
      await tx.botVersion.updateMany({
        where: { botId, published: true },
        data: { published: false },
      });
      await tx.botVersion.updateMany({
        where: { botId, version: versionNumber },
        data: { published: true },
      });
      return tx.bot.update({
        where: { id: botId },
        data: { status: 'active', defaultVersion: versionNumber },
      });
    });
  }
}
