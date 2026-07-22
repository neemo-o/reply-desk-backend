import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { isUuid } from '../../common/utils/security';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ⚡ P-NORM — Validamos contact+session pertecem ao tenant antes de criar
   * conversa. Tudo em $transaction.
   */
  async create(tenantId: string, dto: CreateConversationDto) {
    return this.prisma.$transaction(async (tx) => {
      const [contact, session] = await Promise.all([
        tx.contact.findFirst({ where: { id: dto.contactId, tenantId }, select: { id: true } }),
        tx.whatsappSession.findFirst({ where: { id: dto.sessionId, tenantId }, select: { id: true } }),
      ]);
      if (!contact) throw new NotFoundException('Contato não pertence ao tenant');
      if (!session) throw new NotFoundException('Sessão não pertence ao tenant');
      return tx.conversation.create({
        data: { tenantId, contactId: dto.contactId, sessionId: dto.sessionId },
      });
    });
  }

  /**
   * ⚡ P5 — findAll com cursor pagination + select enxuto em contact.
   * LIMITADO A max-take-100 pelo controller (default 50).
   */
  findAll(
    tenantId: string,
    status?: string,
    opts: { take?: number; cursor?: string } = {},
  ) {
    const take = Math.min(Math.max(opts.take ?? 50, 1), 100);
    return this.prisma.conversation.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { lastMessageAt: 'desc' },
      take,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        contactId: true,
        sessionId: true,
        assignedUser: true,
        status: true,
        priority: true,
        lastMessageAt: true,
        createdAt: true,
        contact: {
          select: { id: true, name: true, phone: true, avatar: true },
        },
      },
    });
  }

  /**
   * ⚡ P6 — findOne com SELECT enxuto + messages paginadas (50 últimas).
   *
   * Evita carregar 5.000 mensagens antigas em JSON quando o front só pede
   * histórico recente. Para paginação retroativa, criar `GET /conversations/:id/messages`.
   */
  async findOne(tenantId: string, id: string) {
    if (!isUuid(id)) throw new NotFoundException('Conversa não encontrada');
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        tenantId: true,
        contactId: true,
        sessionId: true,
        assignedUser: true,
        status: true,
        priority: true,
        lastMessageAt: true,
        createdAt: true,
        contact: {
          select: { id: true, name: true, phone: true, avatar: true, email: true },
        },
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 50,
          select: {
            id: true,
            direction: true,
            type: true,
            content: true,
            mediaUrl: true,
            status: true,
            timestamp: true,
          },
        },
      },
    });
    if (!conversation) throw new NotFoundException('Conversa não encontrada');
    return conversation;
  }

  /**
   * ⚡ P-TRANS — sendMessage + lastMessageAt numa única transação.
   * Status 'pending' do BullMQ worker promove a 'sent'/'failed' depois.
   */
  async sendMessage(tenantId: string, conversationId: string, dto: SendMessageDto) {
    await this.findOne(tenantId, conversationId);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          direction: 'outbound',
          type: dto.type,
          content: dto.content,
          mediaUrl: dto.mediaUrl,
          status: 'pending',
        },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });
      return created;
    });
  }

  async assign(tenantId: string, conversationId: string, dto: AssignConversationDto) {
    if (!isUuid(dto.userId)) throw new NotFoundException('Conversa não encontrada');
    await this.findOne(tenantId, conversationId);

    const targetMembership = await this.prisma.tenantUser.findFirst({
      where: { tenantId, userId: dto.userId, status: 'active' },
      select: { userId: true },
    });
    if (!targetMembership) {
      throw new NotFoundException('Usuário não pertence a este tenant');
    }

    return this.prisma.$transaction([
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { assignedUser: dto.userId },
      }),
      this.prisma.conversationAssignment.create({
        data: { conversationId, userId: dto.userId },
      }),
    ]);
  }

  async close(tenantId: string, conversationId: string) {
    await this.findOne(tenantId, conversationId);
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'closed' },
    });
  }
}
