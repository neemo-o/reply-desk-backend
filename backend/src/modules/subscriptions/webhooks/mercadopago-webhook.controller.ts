import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SubscriptionsService } from '../subscriptions.service';
import { Public } from '../../../common/decorators/public.decorator';

/**
 * 🔒 Endpoint público (o Mercado Pago não autentica via JWT). A segurança
 * vem da validação de assinatura HMAC feita em SubscriptionsService, não
 * deste endpoint estar "escondido" — nunca confiar em security by obscurity aqui.
 */
@Controller('webhooks/mercadopago')
export class MercadoPagoWebhookController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post()
  handle(
    @Body() body: Record<string, any>,
    @Headers() headers: Record<string, string | undefined>,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.subscriptionsService.handleWebhookNotification(body, headers, query);
  }
}
