import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StripeService } from './stripe.service';
import type Stripe from 'stripe';

interface SubscriptionLike {
  status: string;
  trialUntil: Date | null;
  expiresAt: Date | null;
}

function isUniqueConstraintError(err: unknown): boolean {
  return !!err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002';
}

export type BillingType = 'recurring' | 'one_time';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly stripe: StripeService,
  ) {}

  /**
   * Uma assinatura é considerada ativa se:
   * - status "trialing" e o período de trial ainda não expirou; ou
   * - status "active" e não passou da data de expiração.
   * Qualquer outro status (pending, past_due, cancelled) bloqueia o acesso.
   */
  isActive(subscription: SubscriptionLike): boolean {
    const now = new Date();
    if (subscription.status === 'trialing') {
      return !subscription.trialUntil || subscription.trialUntil > now;
    }
    if (subscription.status === 'active') {
      return !subscription.expiresAt || subscription.expiresAt > now;
    }
    return false;
  }

  async getCurrent(tenantId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
    if (!subscription) return null;
    return { ...subscription, isActive: this.isActive(subscription) };
  }

  /**
   * Cria uma sessão de checkout no Stripe.
   * - billingType "recurring": assinatura mensal automática (cartão de crédito)
   * - billingType "one_time": pagamento único (cartão ou Pix, 1 mês de acesso)
   */
  async createCheckout(tenantId: string, planId: string, billingType: BillingType = 'recurring') {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plano não encontrado');

    // Valida que o plano tem o price ID do Stripe para o tipo de cobrança
    const priceId =
      billingType === 'recurring' ? plan.stripePriceRecurringId : plan.stripePriceOneTimeId;
    if (!priceId) {
      throw new BadRequestException(
        `Plano não configurado no Stripe para pagamento ${billingType === 'recurring' ? 'recorrente' : 'único'}`,
      );
    }

    const owner = await this.prisma.tenantUser.findFirst({
      where: { tenantId, role: { name: 'owner' } },
      include: { user: { select: { email: true, emailVerified: true } } },
    });
    if (!owner) throw new NotFoundException('Owner do tenant não encontrado');
    if (!owner.user.emailVerified) {
      throw new ForbiddenException('Confirme seu e-mail antes de contratar um plano');
    }

    const successUrl = this.config.get<string>('stripe.checkoutSuccessUrl');
    const cancelUrl = this.config.get<string>('stripe.checkoutCancelUrl');
    if (!successUrl || !cancelUrl) {
      throw new BadRequestException('STRIPE_CHECKOUT_SUCCESS_URL/CANCEL_URL não configuradas');
    }

    // 🔒 Advisory lock por tenant — serializa o checkout, elimina race condition
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`;

      const rows = await tx.$queryRaw<
        Array<{ id: string; status: string; external_id: string | null; plan_id: string; billing_type: string }>
      >`SELECT id, status, external_id, plan_id, billing_type FROM subscriptions WHERE tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT 1`;

      const current = rows[0]
        ? {
            id: rows[0].id,
            status: rows[0].status,
            externalId: rows[0].external_id,
            planId: rows[0].plan_id,
            billingType: rows[0].billing_type,
          }
        : null;

      // Bloqueia se já tem assinatura ativa válida
      if (current && this.isActive({ status: current.status, trialUntil: null, expiresAt: null }) && current.status === 'active') {
        throw new ConflictException('Este tenant já possui uma assinatura ativa');
      }

      // Reusa subscription pending existente
      const subscriptionId = current && current.status === 'pending' ? current.id : randomUUID();

      const checkoutInput = {
        priceId,
        customerEmail: owner.user.email,
        tenantId,
        subscriptionId,
        successUrl,
        cancelUrl,
      };

      let result: { checkoutUrl: string; sessionId: string };
      if (billingType === 'recurring') {
        result = await this.stripe.createRecurringCheckoutSession(checkoutInput);
      } else {
        result = await this.stripe.createOneTimeCheckoutSession(checkoutInput);
      }

      await tx.subscription.upsert({
              where: { id: subscriptionId },
              update: {
                planId: plan.id,
                status: 'pending',
                externalId: result.sessionId,
                billingType,
              },
              create: {
                id: subscriptionId,
                tenantId,
                planId: plan.id,
                status: 'pending',
                externalId: result.sessionId,
                billingType,
              },
            });

            return { checkoutUrl: result.checkoutUrl, subscriptionId, billingType };
          });
        }

  /**
   * Cancela a assinatura ativa do tenant.
   * Para recorrente: cancela no Stripe (para de cobrar).
   * Para pagamento único: apenas marca como cancelled no DB.
   */
  async cancelSubscription(tenantId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId, status: { in: ['active', 'past_due', 'pending'] } },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new NotFoundException('Nenhuma assinatura ativa encontrada');
    }

    // Se for recorrente, cancela no Stripe
    if (subscription.billingType === 'recurring' && subscription.externalId) {
      // externalId pode ser o session ID ou subscription ID do Stripe
      // Tenta buscar a subscription do Stripe via session
      try {
        const session = await this.stripe.client.checkout.sessions.retrieve(subscription.externalId);
        if (session.subscription) {
          await this.stripe.cancelSubscription(session.subscription as string);
        }
      } catch (err) {
        this.logger.warn(`Erro ao cancelar no Stripe: ${(err as Error).message}`);
        // Continua e marca como cancelled no DB mesmo se Stripe falhar
      }
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'cancelled' },
    });

    return { cancelled: true, subscriptionId: subscription.id };
  }

  /**
   * 🔒 Processa webhooks do Stripe com validação de assinatura e idempotência.
   */
  async handleWebhookEvent(event: Stripe.Event) {
    const eventId = event.id;
    const eventType = event.type;

    // Idempotência — mesmo evento nunca é processado duas vezes
    try {
      await this.prisma.paymentWebhookEvent.create({
        data: { provider: 'stripe', externalId: eventId, eventType },
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        this.logger.log(`Evento Stripe ${eventId} já processado — ignorado`);
        return { received: true, duplicate: true };
      }
      throw err;
    }

    switch (eventType) {
      case 'checkout.session.completed': {
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;
      }
      default: {
        this.logger.log(`Evento Stripe ${eventType} ignorado`);
        return { received: true, ignored: true };
      }
    }

    return { received: true };
  }

  /**
   * Quando o checkout é completado — atualiza a subscription local.
   * Para recurring: o Stripe já criou a subscription, pegamos o ID.
   * Para one_time: o pagamento foi confirmado, damos 1 mês de acesso.
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const tenantId = session.client_reference_id;
    if (!tenantId) {
      this.logger.warn('Checkout sem client_reference_id');
      return;
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId, externalId: session.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      this.logger.warn(`Nenhuma subscription local para session ${session.id}`);
      return;
    }

    if (session.mode === 'subscription' && session.subscription) {
      // Recorrente: atualiza externalId para o subscription ID do Stripe
      const stripeSubId = session.subscription as string;
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'active',
          externalId: stripeSubId,
          lastPaymentId: session.payment_intent as string,
          startsAt: new Date(),
          expiresAt: this.oneMonthFromNow(),
        },
      });
    } else if (session.mode === 'payment') {
      // Pagamento único: ativa por 1 mês
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'active',
          lastPaymentId: session.payment_intent as string,
          startsAt: new Date(),
          expiresAt: this.oneMonthFromNow(),
        },
      });
    }
  }

  /**
   * Quando o Stripe atualiza/cancela uma assinatura recorrente.
   * Sincroniza o status do Stripe com o banco local.
   */
  private async handleSubscriptionUpdate(stripeSubscription: Stripe.Subscription) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { externalId: stripeSubscription.id },
    });

    if (!subscription) {
      this.logger.warn(`Nenhuma subscription local para Stripe sub ${stripeSubscription.id}`);
      return;
    }

    const status = this.mapStripeStatus(stripeSubscription.status);
    const currentPeriodEnd = stripeSubscription.current_period_end
      ? new Date(stripeSubscription.current_period_end * 1000)
      : null;

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status,
        expiresAt: currentPeriodEnd,
      },
    });
  }

  private mapStripeStatus(stripeStatus: string): string {
    switch (stripeStatus) {
      case 'active':
      case 'trialing':
        return 'active';
      case 'past_due':
      case 'unpaid':
        return 'past_due';
      case 'canceled':
        return 'cancelled';
      case 'incomplete':
      case 'incomplete_expired':
        return 'pending';
      default:
        return 'pending';
    }
  }

  private oneMonthFromNow(): Date {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date;
  }
}
