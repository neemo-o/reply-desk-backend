import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { isUuid } from '../utils/security';

/**
 * ⚡ P2 — TenantGuard com cache de membership via Redis.
 *
 * Cada request autenticado roda `prisma.tenantUser.findFirst` para validar
 * o vínculo (user, tenant). Em 100 RPS isso vira 100 queries idênticas
 * para a maioria dos usuários.
 *
 * Cache aqui tem TTL de 60s:
 * - alterações em membership (incluir/excluir member) propagam em ≤ 60s
 * - chave inclui (userId, tenantId) → sem cross-tenant leak
 *
 * RedisService já tem retryStrategy; se cair, fail-open para Prisma direto.
 */
const CACHE_TTL_SEC = 60;

interface CachedMembership {
  role: string;
  roleId: string;
}

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const rawTenantId = request.headers['x-tenant-id'];

    if (typeof rawTenantId !== 'string' || rawTenantId.trim() === '') {
      throw new BadRequestException('Header x-tenant-id é obrigatório');
    }

    const tenantId = rawTenantId.trim();
    if (!isUuid(tenantId)) {
      throw new BadRequestException('Header x-tenant-id inválido');
    }

    const user = request.user;
    if (!user?.sub || !isUuid(user.sub)) {
      throw new ForbiddenException('Sessão inválida');
    }

    const cacheKey = `tenant-auth:${user.sub}:${tenantId}`;
    let cached: CachedMembership | null = null;

    try {
      const raw = await this.redis.get(cacheKey);
      if (raw) cached = JSON.parse(raw) as CachedMembership;
    } catch (err) {
      this.logger.warn(`Cache read falhou: ${(err as Error).message}`);
    }

    if (cached) {
      request.tenantId = tenantId;
      request.user.tenantId = tenantId;
      request.user.role = cached.role;
      request.user.roleId = cached.roleId;
      return true;
    }

    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { tenantId, userId: user.sub, status: 'active' },
      select: {
        id: true,
        roleId: true,
        role: { select: { name: true } },
      },
    });

    if (!tenantUser) {
      throw new ForbiddenException('Usuário não pertence a este tenant');
    }

    const membership: CachedMembership = {
      role: tenantUser.role.name,
      roleId: tenantUser.roleId,
    };

    try {
      await this.redis.set(cacheKey, JSON.stringify(membership), 'EX', CACHE_TTL_SEC);
    } catch (err) {
      this.logger.warn(`Cache write falhou: ${(err as Error).message}`);
    }

    request.tenantId = tenantId;
    request.user.tenantId = tenantId;
    request.user.role = membership.role;
    request.user.roleId = membership.roleId;

    return true;
  }
}
