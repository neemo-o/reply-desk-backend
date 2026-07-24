import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PlanLimitsService } from '../subscriptions/plan-limits.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { InviteUserDto } from './dto/invite-user.dto';

const DEFAULT_ROLES = [
  { name: 'owner', description: 'Acesso total ao tenant' },
  { name: 'admin', description: 'Gerencia usuários e configurações' },
  { name: 'agent', description: 'Atende conversas' },
];

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  /**
   * DB-4 — Slug race condition eliminada: catch P2002 em vez de findUnique+create.
   * Normalização: slug vira lowercase + kebab-case antes de salvar.
   */
  async create(ownerId: string, dto: CreateTenantDto) {
    const slug = dto.slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: dto.name.trim(),
            slug,
            timezone: dto.timezone ?? 'America/Sao_Paulo',
          },
        });

        const roles = await Promise.all(
          DEFAULT_ROLES.map((role) =>
            tx.role.create({ data: { ...role, tenantId: tenant.id } }),
          ),
        );

        const ownerRole = roles.find((r) => r.name === 'owner');
        if (!ownerRole) throw new NotFoundException('Role owner não foi criado');

        await tx.tenantUser.create({
          data: { tenantId: tenant.id, userId: ownerId, roleId: ownerRole.id },
        });

        return tenant;
      });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
        throw new ConflictException('Slug já utilizado');
      }
      throw err;
    }
  }

  async findMine(userId: string) {
    return this.prisma.tenant.findMany({
      where: { tenantUsers: { some: { userId, status: 'active' } } },
      select: { id: true, name: true, slug: true, logo: true, status: true, createdAt: true },
    });
  }

  async inviteUser(tenantId: string, dto: InviteUserDto) {
    // 🔒 M7 — Verifica limite de usuários do plano antes de convidar
    await this.planLimits.assertCanInviteUser(tenantId);

    const role = await this.prisma.role.findFirst({
      where: { tenantId, name: dto.roleName },
      select: { id: true },
    });
    if (!role) throw new NotFoundException('Papel (role) não encontrado neste tenant');

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado — peça para ele se cadastrar primeiro');

    try {
      return await this.prisma.tenantUser.create({
        data: { tenantId, userId: user.id, roleId: role.id },
        select: { id: true, tenantId: true, userId: true, status: true },
      });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
        throw new ConflictException('Usuário já é membro deste tenant');
      }
      throw err;
    }
  }

  async listMembers(tenantId: string) {
    return this.prisma.tenantUser.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, name: true, email: true } }, role: { select: { name: true } } },
    });
  }
}
