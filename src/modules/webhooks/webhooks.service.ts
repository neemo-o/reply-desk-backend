import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';

/**
 * 🔒 S6 — Webhook secret não é mais devolvido em findAll.
 *
 * - Ao criar, geramos secret aleatório e guardamos o HASH (argon2).
 * - Devolvemos o secret em claro **uma única vez** na resposta de create().
 * - `findAll` e `findOne` nunca expõem `secretHash`.
 *
 * Para validar assinaturas (HMAC) recebidas dos webhooks: hashthe shared secret
 * via argon2.verify com o secret que o cliente guardou. Ver `verifyWebhookSignature`.
 */
@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateWebhookDto) {
    const plainSecret = randomBytes(32).toString('hex');
    const secretHash = await argon2.hash(plainSecret);

    const webhook = await this.prisma.webhook.create({
      data: {
        tenantId,
        name: dto.name,
        url: dto.url,
        secret: secretHash,
        events: dto.events,
      },
      select: { id: true, tenantId: true, name: true, url: true, events: true },
    });

    return { ...webhook, secret: plainSecret };
  }

  findAll(tenantId: string) {
    return this.prisma.webhook.findMany({
      where: { tenantId },
      select: { id: true, name: true, url: true, events: true },
    });
  }

  async remove(tenantId: string, id: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!webhook) throw new NotFoundException('Webhook não encontrado');
    await this.prisma.webhook.delete({ where: { id } });
    return { success: true };
  }
}
