import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PlanLimitsService } from '../subscriptions/plan-limits.service';
import { isUuid } from '../../common/utils/security';
import { CreateSessionDto } from './dto/create-session.dto';

@Injectable()
export class WhatsappSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  /**
   * ⚡ P-NORM — Cria sessão para tenantId. Persiste e devolve select enxuto.
   * Enfileiramento da connection real acontece no controller (BullMQ).
   * 🔒 M7 — Verifica limite de sessions do plano antes de criar.
   */
  async create(tenantId: string, dto: CreateSessionDto) {
    await this.planLimits.assertCanCreateSession(tenantId);
    // sessionName já era gerado como `${tenantId}-${uuid}`. Aqui mantemos.
    const sessionName = `${tenantId}-${Date.now().toString(36)}`;
    const session = await this.prisma.whatsappSession.create({
      data: {
        tenantId,
        name: dto.name,
        phone: dto.phone,
        sessionName,
        status: 'connecting',
      },
      select: {
        id: true, tenantId: true, name: true, phone: true,
        sessionName: true, status: true, lastSeen: true, createdAt: true,
      },
    });
    return session;
  }

  findAll(tenantId: string, opts: { take?: number; cursor?: string } = {}) {
    const take = Math.min(Math.max(opts.take ?? 50, 1), 100);
    return this.prisma.whatsappSession.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        name: true,
        phone: true,
        sessionName: true,
        evolutionInstanceId: true,
        status: true,
        lastSeen: true,
        createdAt: true,
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    if (!isUuid(id)) throw new NotFoundException('Sessão não encontrada');
    const session = await this.prisma.whatsappSession.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        phone: true,
        sessionName: true,
        evolutionInstanceId: true,
        status: true,
        qrCode: true,
        lastSeen: true,
        createdAt: true,
        updatedAt: true,
        settings: { select: { webhookUrl: true, autoReconnect: true, ignoreGroups: true } },
      },
    });
    if (!session) throw new NotFoundException('Sessão não encontrada');
    return session;
  }

  async disconnect(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.whatsappSession.update({
      where: { id },
      data: { status: 'disconnected' },
      select: { id: true, status: true, updatedAt: true },
    });
  }

  async updateStatus(sessionId: string, status: string, extra?: Record<string, unknown>) {
    return this.prisma.whatsappSession.update({
      where: { id: sessionId },
      data: { status, ...extra },
    });
  }
}
