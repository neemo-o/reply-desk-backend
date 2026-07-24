import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { SubscriptionsService } from '../subscriptions.service';
import { StripeService } from '../stripe.service';
import { Public } from '../../../common/decorators/public.decorator';
import { ForbiddenException } from '@nestjs/common';

/**
 * 🔒 Endpoint público (o Stripe não autentica via JWT).
 * A segurança vem da validação de assinatura do webhook (signing secret),
 * validada nativamente pelo SDK do Stripe.
 */
@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly stripeService: StripeService,
  ) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 100, ttl: 60_000 } })
  @Post()
  async handle(
    @Req() req: Request & { rawBody: Buffer },
    @Headers() headers: Record<string, string | undefined>,
  ) {
    const signature = headers['stripe-signature'];
    if (!signature) {
      throw new ForbiddenException('Header stripe-signature ausente');
    }

    // O Stripe envia o body raw — precisamos do rawBody para validar a assinatura.
    // O rawBody é capturado via middleware no main.ts.
    const rawBody = req.rawBody ?? (Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body)));

    let event;
    try {
      event = this.stripeService.constructWebhookEvent(rawBody, signature);
    } catch {
      throw new ForbiddenException('Assinatura do webhook inválida');
    }

    const result = await this.subscriptionsService.handleWebhookEvent(event);
    return result;
  }
}
