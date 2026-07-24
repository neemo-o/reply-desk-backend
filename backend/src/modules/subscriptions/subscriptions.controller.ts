import { Body, Controller, Delete, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { UpgradePlanDto } from './dto/upgrade-plan.dto';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@UseGuards(TenantGuard, RolesGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('me')
  getCurrent(@CurrentTenant() tenantId: string) {
    return this.subscriptionsService.getCurrent(tenantId);
  }

  /**
   * Cria uma sessão de checkout no Stripe.
   * billingType "recurring" (padrão): assinatura mensal automática com cartão
   * billingType "one_time": pagamento único (cartão ou Pix, 1 mês de acesso)
   */
  @Roles('owner', 'admin')
  @Post('checkout')
  createCheckout(@CurrentTenant() tenantId: string, @Body() dto: CreateCheckoutDto) {
    return this.subscriptionsService.createCheckout(tenantId, dto.planId, dto.billingType ?? 'recurring');
  }

  /**
   * Upgrade/downgrade de plano.
   * Atualiza a subscription ativa no Stripe com prorratação automática.
   * O Stripe credita dias não usados do plano anterior e debita o proporcional do novo.
   */
  @Roles('owner', 'admin')
  @Patch('upgrade')
  upgradePlan(@CurrentTenant() tenantId: string, @Body() dto: UpgradePlanDto) {
    return this.subscriptionsService.upgradePlan(tenantId, dto.planId);
  }

  /**
   * Cancela a assinatura ativa do tenant.
   * Para recorrente: cancela no Stripe (para de cobrar).
   * Para pagamento único: marca como cancelled.
   */
  @Roles('owner', 'admin')
  @Delete('cancel')
  cancel(@CurrentTenant() tenantId: string) {
    return this.subscriptionsService.cancelSubscription(tenantId);
  }
}
