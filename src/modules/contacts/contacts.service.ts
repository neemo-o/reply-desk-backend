import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { isUuid } from '../../common/utils/security';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ⚡ P-NORM — Normalização: `phone` armazenada só com dígitos;
   * email é única dentro do tenant via UNIQUE(tenant_id, email).
   */
  create(tenantId: string, dto: CreateContactDto) {
    const phone = (dto.phone ?? '').replace(/\D/g, '');
    return this.prisma.contact.create({
      data: {
        tenantId,
        phone,
        name: dto.name,
        email: (dto.email ?? '').toLowerCase() || undefined,
      },
      select: { id: true, tenantId: true, phone: true, name: true, email: true, avatar: true, createdAt: true },
    });
  }

  /**
   * ⚡ P4 — Listagem com paginação cursor + select enxuto.
   * Sem include de conversations aqui — para último preview, campo denormalizado
   * em `DailyMetric` ou usar endpoint separado por conversa.
   */
  findAll(tenantId: string, opts: { take?: number; cursor?: string } = {}) {
    const take = Math.min(Math.max(opts.take ?? 50, 1), 100);
    return this.prisma.contact.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        tenantId: true,
        phone: true,
        name: true,
        email: true,
        avatar: true,
        createdAt: true,
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    if (!isUuid(id)) throw new NotFoundException('Contato não encontrado');
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        tenantId: true,
        phone: true,
        name: true,
        email: true,
        avatar: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!contact) throw new NotFoundException('Contato não encontrado');
    return contact;
  }

  async update(tenantId: string, id: string, dto: UpdateContactDto) {
    await this.findOne(tenantId, id);
    return this.prisma.contact.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.email ? { email: dto.email.toLowerCase() } : {}),
        ...(dto.phone ? { phone: dto.phone.replace(/\D/g, '') } : {}),
      },
      select: { id: true, phone: true, name: true, email: true, avatar: true, notes: true },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.contact.delete({ where: { id } });
    return { success: true };
  }
}
