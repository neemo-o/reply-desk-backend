import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionsService } from '../../modules/subscriptions/subscriptions.service';
import { SKIP_SUBSCRIPTION_KEY } from '../decorators/skip-subscription.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * 🔒 M6 — SubscriptionGuard global.
 *
 * Registrado como APP_GUARD em AppModule, roda DEPOIS de JwtAuthGuard e
 * TenantGuard. Por padrão, bloqueia qualquer rota autenticada que não tenha
 * assinatura ativa/trialing. Rotas marcadas com @SkipSubscription() pulam
 * a verificação. Rotas @Public() também pulam (não há usuário autenticado).
 *
 * Depende de request.tenantId, populado por TenantGuard. Se TenantGuard não
 * rodou antes (endpoints sem x-tenant-id), não há como verificar assinatura —
 * e esses endpoints DEVEM ser marcados com @SkipSubscription().
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // @Public() routes — sem usuário autenticado, sem verificação
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // @SkipSubscription() routes — explicitamente excluídas
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_SUBSCRIPTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenantId;
    if (!tenantId) {
      // Sem tenantId = TenantGuard não populou (endpoint sem x-tenant-id).
      // Se não foi marcado com @SkipSubscription(), bloqueia por segurança.
      throw new ForbiddenException('Tenant não identificado');
    }

    const subscription = await this.subscriptionsService.getCurrent(tenantId);
    if (!subscription || !subscription.isActive) {
      throw new ForbiddenException(
        'Assinatura inativa ou expirada — regularize o pagamento para continuar usando o produto',
      );
    }

    // 🔒 M7 — Disponibiliza o plano atual no request para interceptors/guards
    // downstream validarem limites (maxSessions, maxBots, etc.)
    request.subscription = subscription;
    request.plan = subscription.plan;

    return true;
  }
}
