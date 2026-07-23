import { Global, Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { MercadoPagoService } from './mercado-pago.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PlansController } from './plans.controller';
import { MercadoPagoWebhookController } from './webhooks/mercadopago-webhook.controller';

/**
 * @Global() para que SubscriptionGuard (usado via @UseGuards em outros módulos,
 * seguindo o mesmo padrão do TenantGuard) consiga resolver SubscriptionsService
 * sem cada módulo precisar importar SubscriptionsModule explicitamente.
 */
@Global()
@Module({
  controllers: [SubscriptionsController, PlansController, MercadoPagoWebhookController],
  providers: [SubscriptionsService, MercadoPagoService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
