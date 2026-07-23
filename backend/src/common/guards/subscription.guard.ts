import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { SubscriptionsService } from '../../modules/subscriptions/subscriptions.service';

/**
 * Deve ser usado sempre DEPOIS de TenantGuard (que popula request.tenantId).
 * Bloqueia o acesso a qualquer recurso do produto quando o tenant não tem
 * assinatura trialing/active vigente — impede uso do dashboard sem pagamento.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant não identificado');
    }

    const subscription = await this.subscriptionsService.getCurrent(tenantId);
    if (!subscription || !subscription.isActive) {
      throw new ForbiddenException(
        'Assinatura inativa ou expirada — regularize o pagamento para continuar usando o produto',
      );
    }
    return true;
  }
}
