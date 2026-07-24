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
    hasTrial?: boolean;
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
          // 🔒 Trial de 7 dias apenas para Basic + novos usuários.
          // O Stripe valida o cartão imediatamente (cobra $0) e só cobra
          // de verdade após 7 dias. Se recusar na cobrança, a subscription
          // vai para past_due → bloqueia o tenant.
          ...(input.hasTrial && { trial_period_days: 7 }),
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
   * 🔒 Agenda o cancelamento para o fim do ciclo atual (cancel_at_period_end: true).
   * O usuário continua com acesso até current_period_end. O Stripe envia
   * customer.subscription.deleted quando o ciclo acaba — o webhook marca
   * status 'cancelled' no DB.
   *
   * Padrão SaaS: usuário pagou o mês, mantém acesso até o fim.
   */
  async scheduleCancelAtPeriodEnd(stripeSubscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.client.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    } catch (err) {
      this.logger.error(`Stripe scheduleCancel falhou: ${(err as Error).message}`);
      throw new BadGatewayException('Não foi possível agendar o cancelamento no Stripe');
    }
  }

  /**
   * 🔒 Reativa uma assinatura que estava agendada para cancelar no fim do ciclo.
   * Remove o cancel_at_period_end — o usuário continua sendo cobrado normalmente.
   */
  async reactivateSubscription(stripeSubscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.client.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: false,
      });
    } catch (err) {
      this.logger.error(`Stripe reactivate falhou: ${(err as Error).message}`);
      throw new BadGatewayException('Não foi possível reativar a assinatura no Stripe');
    }
  }

  /**
   * 🔒 Upgrade/downgrade de plano no Stripe.
   * Atualiza o price ID da subscription ativa com prorratação automática.
   * O Stripe calcula crédito pelos dias não usados + débito proporcional do novo plano.
   *
   * payment_behavior: 'pending_if_incomplete' — se a prorratação falhar (cartão recusado),
   * a subscription fica em 'pending' e a troca de plano NÃO é aplicada. O backend
   * checa o status retornado e retorna erro ao usuário em vez de dizer "sucesso".
   */
  async updateSubscriptionPlan(
    stripeSubscriptionId: string,
    newPriceId: string,
  ): Promise<Stripe.Subscription> {
    try {
      // Busca a subscription atual para pegar o item ID
      const subscription = await this.client.subscriptions.retrieve(stripeSubscriptionId);

      if (!subscription.items.data.length) {
        throw new Error('Subscription sem items no Stripe');
      }

      const itemId = subscription.items.data[0].id;

      // Atualiza o price do item com prorratação.
      // pending_if_incomplete: se o pagamento da prorratação falhar, a subscription
      // fica em 'past_due' ou 'incomplete' e a troca de plano é revertida pelo Stripe.
      return await this.client.subscriptions.update(stripeSubscriptionId, {
        items: [{ id: itemId, price: newPriceId }],
        proration_behavior: 'create_prorations',
        payment_behavior: 'pending_if_incomplete',
        metadata: {
          ...subscription.metadata,
          upgradedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      this.logger.error(`Stripe updateSubscriptionPlan falhou: ${(err as Error).message}`);
      throw new BadGatewayException('Não foi possível alterar o plano no Stripe');
    }
  }

  /**
   * 🔒 Pré-visualiza a prorratação de um upgrade/downgrade sem cobrar.
   * Calcula a diferença proporcional manualmente a partir dos dados da subscription
   * atual no Stripe (current_period_end, price do item atual) e o preço do novo plano.
   *
   * Não usa invoices.createPreview porque o Stripe SDK v16 não tem suporte estável
   * para simular troca de items via preview — retorna valor integral em vez de prorratação.
   */
  async previewUpgradeInvoice(
    stripeSubscriptionId: string,
    newPriceId: string,
  ): Promise<{ amountDue: number; currency: string; prorationDate: number }> {
    try {
      // Busca a subscription atual com o price do item
      const subscription = await this.client.subscriptions.retrieve(stripeSubscriptionId, {
        expand: ['items.data.price'],
      });
      if (!subscription.items.data.length) {
        throw new Error('Subscription sem items no Stripe');
      }

      const currentItem = subscription.items.data[0];
      const currentPrice = currentItem.price;
      if (!currentPrice) {
        throw new Error('Price do item atual não encontrado no Stripe');
      }

      // Busca o novo price
      const newPrice = await this.client.prices.retrieve(newPriceId);

      // Calcula a prorratação manualmente
      // Valor = (novoPreçoDiário - preçoAtualDiário) × diasRestantes
      const now = Math.floor(Date.now() / 1000);
      const periodEnd = subscription.current_period_end;
      const daysRemaining = Math.max(0, Math.ceil((periodEnd - now) / 86400));

      // Preços em centavos — ambos são mensais (recurring.interval = 'month')
      const currentMonthlyAmount = currentPrice.unit_amount ?? 0;
      const newMonthlyAmount = newPrice.unit_amount ?? 0;

      // Assumindo mês de 30 dias (padrão do Stripe para prorratação)
      const currentDailyAmount = currentMonthlyAmount / 30;
      const newDailyAmount = newMonthlyAmount / 30;

      const prorationAmount = Math.round((newDailyAmount - currentDailyAmount) * daysRemaining);

      return {
        amountDue: prorationAmount,
        currency: newPrice.currency,
        prorationDate: now,
      };
    } catch (err) {
      this.logger.error(`Stripe previewUpgradeInvoice falhou: ${(err as Error).message}`);
      throw new BadGatewayException('Não foi possível pré-visualizar a prorratação no Stripe');
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
