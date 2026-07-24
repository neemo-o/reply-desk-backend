import { Global, Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from './stripe.service';
import { PlanLimitsService } from './plan-limits.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PlansController } from './plans.controller';
import { StripeWebhookController } from './webhooks/stripe-webhook.controller';
import { BlockedTenantCleanupJob } from './blocked-tenant-cleanup.job';

/**
 * @Global() para que SubscriptionGuard (usado via @UseGuards em outros módulos)
 * consiga resolver SubscriptionsService sem cada módulo precisar importar
 * SubscriptionsModule explicitamente.
 *
 * 🔒 M7/M8 — PlanLimitsService é @Global() também para que outros módulos
 * (whatsapp-sessions, bots, tenants) injetem sem importar explicitamente.
 */
@Global()
@Module({
  controllers: [SubscriptionsController, PlansController, StripeWebhookController],
  providers: [SubscriptionsService, StripeService, PlanLimitsService, BlockedTenantCleanupJob],
  exports: [SubscriptionsService, PlanLimitsService],
})
export class SubscriptionsModule {}
