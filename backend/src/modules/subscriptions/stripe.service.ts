import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * 🔒 Integração com a API do Stripe.
 *
 * Suporta dois fluxos de pagamento:
 * 1. Recorrente (Subscription Billing) — cobra cartão automaticamente todo mês
 * 2. Pagamento único (Checkout Session one_time) — cartão ou Pix, 1 mês de acesso
 *
 * Usa o SDK oficial do Stripe em vez de fetch manual — tipagem completa,
 * retry automático, e assinatura de webhook validada nativamente.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  readonly client: Stripe;

  constructor(private readonly config: ConfigService) {
    const secretKey = this.config.get<string>('stripe.secretKey');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY não configurada');
    }
    this.client = new Stripe(secretKey, {
      apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
      typescript: true,
    });
  }

  get webhookSecret(): string | undefined {
    return this.config.get<string>('stripe.webhookSecret');
  }

  /**
   * Cria uma Checkout Session para assinatura recorrente (cartão de crédito).
   * O Stripe cobra automaticamente todo mês — sem intervenção do backend.
   */
  async createRecurringCheckoutSession(input: {
    priceId: string;
    customerEmail: string;
    tenantId: string;
    subscriptionId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ checkoutUrl: string; sessionId: string }> {
    try {
      const session = await this.client.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: input.priceId, quantity: 1 }],
        customer_email: input.customerEmail,
        client_reference_id: input.tenantId,
        subscription_data: {
          metadata: {
            tenantId: input.tenantId,
            subscriptionId: input.subscriptionId,
          },
        },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      });

      return {
        checkoutUrl: session.url!,
        sessionId: session.id,
      };
    } catch (err) {
      this.logger.error(`Stripe recurring checkout falhou: ${(err as Error).message}`);
      throw new BadGatewayException('Não foi possível criar a sessão de pagamento no Stripe');
    }
  }

  /**
   * Cria uma Checkout Session para pagamento único (cartão ou Pix).
   * O usuário paga uma vez e tem acesso por 1 mês. Após expirar, precisa pagaragain.
   */
  async createOneTimeCheckoutSession(input: {
    priceId: string;
    customerEmail: string;
    tenantId: string;
    subscriptionId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ checkoutUrl: string; sessionId: string }> {
    try {
      const session = await this.client.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price: input.priceId, quantity: 1 }],
        customer_email: input.customerEmail,
        client_reference_id: input.tenantId,
        payment_intent_data: {
          metadata: {
            tenantId: input.tenantId,
            subscriptionId: input.subscriptionId,
            billingType: 'one_time',
          },
        },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      });

      return {
        checkoutUrl: session.url!,
        sessionId: session.id,
      };
    } catch (err) {
      this.logger.error(`Stripe one-time checkout falhou: ${(err as Error).message}`);
      throw new BadGatewayException('Não foi possível criar a sessão de pagamento no Stripe');
    }
  }

  /**
   * Busca uma subscrição no Stripe pelo ID.
   */
  async getSubscription(stripeSubscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.client.subscriptions.retrieve(stripeSubscriptionId);
    } catch (err) {
      this.logger.error(`Stripe getSubscription falhou: ${(err as Error).message}`);
      throw new BadGatewayException('Não foi possível consultar a assinatura no Stripe');
    }
  }

  /**
   * Cancela uma assinatura recorrente no Stripe.
   */
  async cancelSubscription(stripeSubscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.client.subscriptions.cancel(stripeSubscriptionId);
    } catch (err) {
      this.logger.error(`Stripe cancelSubscription falhou: ${(err as Error).message}`);
      throw new BadGatewayException('Não foi possível cancelar a assinatura no Stripe');
    }
  }

  /**
   * Valida a assinatura do webhook do Stripe usando o signing secret.
   * Retorna o evento decodificado ou lança exceção se inválido.
   */
  constructWebhookEvent(payload: Buffer | string, signature: string): Stripe.Event {
    const secret = this.webhookSecret;
    if (!secret) {
      throw new Error('STRIPE_WEBHOOK_SECRET não configurada');
    }
    try {
      return this.client.webhooks.constructEvent(
        typeof payload === 'string' ? Buffer.from(payload) : payload,
        signature,
        secret,
      );
    } catch (err) {
      this.logger.warn(`Webhook Stripe rejeitado — assinatura inválida: ${(err as Error).message}`);
      throw new Error('Assinatura inválida');
    }
  }

  /**
   * Cria um produto e dois preços no Stripe (recorrente + único) para um plano.
   * Usado pelo seed/setup.
   */
  async createProductWithPrices(input: {
    name: string;
    amount: number; // em reais (ex: 49.90)
  }): Promise<{ productId: string; recurringPriceId: string; oneTimePriceId: string }> {
    const product = await this.client.products.create({ name: input.name });

    const recurringPrice = await this.client.prices.create({
      product: product.id,
      currency: 'brl',
      unit_amount: Math.round(input.amount * 100), // Stripe usa centavos
      recurring: { interval: 'month' },
    });

    const oneTimePrice = await this.client.prices.create({
      product: product.id,
      currency: 'brl',
      unit_amount: Math.round(input.amount * 100),
    });

    return {
      productId: product.id,
      recurringPriceId: recurringPrice.id,
      oneTimePriceId: oneTimePrice.id,
    };
  }
}
