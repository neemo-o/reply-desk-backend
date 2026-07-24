import { Global, Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from './stripe.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PlansController } from './plans.controller';
import { StripeWebhookController } from './webhooks/stripe-webhook.controller';

/**
 * @Global() para que SubscriptionGuard (usado via @UseGuards em outros módulos)
 * consiga resolver SubscriptionsService sem cada módulo precisar importar
 * SubscriptionsModule explicitamente.
 */
@Global()
@Module({
  controllers: [SubscriptionsController, PlansController, StripeWebhookController],
  providers: [SubscriptionsService, StripeService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
