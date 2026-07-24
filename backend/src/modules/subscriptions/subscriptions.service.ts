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
        Array<{ id: string; status: string; external_id: string | null; plan_id: string; billing_type: string; trial_until: Date | null; expires_at: Date | null }>
      >`SELECT id, status, external_id, plan_id, billing_type, trial_until, expires_at FROM subscriptions WHERE tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT 1`;

      const current = rows[0]
        ? {
            id: rows[0].id,
            status: rows[0].status,
            externalId: rows[0].external_id,
            planId: rows[0].plan_id,
            billingType: rows[0].billing_type,
            trialUntil: rows[0].trial_until,
            expiresAt: rows[0].expires_at,
          }
        : null;

      // Bloqueia se já tem assinatura ativa ou em trial válida
      if (current && this.isActive({ status: current.status, trialUntil: current.trialUntil, expiresAt: current.expiresAt }) && (current.status === 'active' || current.status === 'trialing')) {
        throw new ConflictException('Este tenant já possui uma assinatura ativa');
      }

      // Reusa subscription pending existente
      const subscriptionId = current && current.status === 'pending' ? current.id : randomUUID();

      // 🔒 Trial de 7 dias apenas para o plano Basic E apenas para novos usuários.
      // Considera "novo usuário" = nunca teve subscription ativa, trial, cancelada
      // ou past_due. Subscription pending (checkout não completado) não conta.
      const hadPreviousSubscription =
        current !== null &&
        current.status !== 'pending';
      const hasTrial = plan.id === 'basic-plan' && !hadPreviousSubscription;

      const checkoutInput = {
        priceId,
        customerEmail: owner.user.email,
        tenantId,
        subscriptionId,
        successUrl,
        cancelUrl,
        hasTrial,
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
      // Após o webhook checkout.session.completed, o externalId é sobrescrito
      // de cs_... (session ID) para sub_... (subscription ID do Stripe).
      // Detectar qual é para usar a API correta.
      try {
        if (subscription.externalId.startsWith('sub_')) {
          // Já é o subscription ID do Stripe — cancela diretamente
          await this.stripe.cancelSubscription(subscription.externalId);
        } else {
          // Ainda é session ID (webhook ainda não processou) — busca a subscription via session
          const session = await this.stripe.client.checkout.sessions.retrieve(subscription.externalId);
          if (session.subscription) {
            await this.stripe.cancelSubscription(session.subscription as string);
          }
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
   * 🔒 Upgrade/downgrade de plano.
   * Só funciona para subscriptions recorrentes ativas ou em trial.
   * O Stripe faz a prorratação automaticamente (credita dias não usados,
   * debita proporcional do novo plano).
   */
  async upgradePlan(tenantId: string, newPlanId: string) {
    // Valida o novo plano
    const newPlan = await this.prisma.plan.findUnique({ where: { id: newPlanId } });
    if (!newPlan) throw new NotFoundException('Plano não encontrado');
    if (!newPlan.stripePriceRecurringId) {
      throw new BadRequestException('Novo plano não configurado no Stripe para pagamento recorrente');
    }

    // Busca a subscription ativa/trialing do tenant
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId, status: { in: ['active', 'trialing'] } },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new NotFoundException('Nenhuma assinatura ativa encontrada para upgrade');
    }

    if (subscription.billingType !== 'recurring') {
      throw new BadRequestException('Upgrade só está disponível para assinaturas recorrentes');
    }

    if (!subscription.externalId || !subscription.externalId.startsWith('sub_')) {
      throw new BadRequestException('Assinatura ainda não foi ativada no Stripe — aguarde o processamento do pagamento');
    }

    if (subscription.planId === newPlanId) {
      throw new BadRequestException('Você já está neste plano');
    }

    // Atualiza no Stripe com prorratação
    const updatedSub = await this.stripe.updateSubscriptionPlan(
      subscription.externalId,
      newPlan.stripePriceRecurringId,
    );

    // Atualiza no DB
    const currentPeriodEnd = updatedSub.current_period_end
      ? new Date(updatedSub.current_period_end * 1000)
      : null;

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: newPlan.id,
        expiresAt: currentPeriodEnd,
      },
    });

    return {
      upgraded: true,
      subscriptionId: subscription.id,
      newPlan: newPlan.name,
      newPrice: newPlan.price,
    };
  }

  /**
   * 🔒 Processa webhooks do Stripe com validação de assinatura e idempotência.
   */
  async handleWebhookEvent(event: Stripe.Event) {
    // 🔒 Rejeita eventos de teste em produção — evita que webhooks de sandbox
    // ativem assinaturas reais sem pagamento
    if (process.env.NODE_ENV === 'production' && event.livemode === false) {
      this.logger.warn(`Evento de teste Stripe rejeitado em produção: ${event.id} (${event.type})`);
      throw new ForbiddenException('Eventos de teste não são permitidos em produção');
    }

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

    // Busca a subscription local pelo session ID (cs_test_...).
    // Se o webhook customer.subscription.updated chegou ANTES (race condition),
    // o externalId no DB já foi mudado para sub_... — nesse caso faz fallback
    // buscando por tenantId + status ativo.
    let subscription = await this.prisma.subscription.findFirst({
      where: { tenantId, externalId: session.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      // Fallback: subscription.updated já mudou o externalId para sub_...
      // Usa o subscription ID do Stripe vindo na session para buscar diretamente.
      const stripeSubId = session.subscription as string | null;
      if (stripeSubId) {
        subscription = await this.prisma.subscription.findFirst({
          where: { tenantId, externalId: stripeSubId },
          orderBy: { createdAt: 'desc' },
        });
      }
    }

    if (!subscription) {
      // Último fallback: busca qualquer subscription ativa do tenant
      subscription = await this.prisma.subscription.findFirst({
        where: { tenantId, status: { in: ['pending', 'active', 'trialing'] } },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!subscription) {
      this.logger.warn(`Nenhuma subscription local para session ${session.id}`);
      return;
    }

    if (session.mode === 'subscription' && session.subscription) {
      // Recorrente: atualiza externalId para o subscription ID do Stripe.
      // Em modo subscription, o Stripe NÃO usa payment_intent — usa latest_invoice.
      // Buscamos a subscription do Stripe para pegar current_period_end e latest_invoice
      // em vez de calcular manualmente oneMonthFromNow() que pode dessincronizar do Stripe.
      const stripeSubId = session.subscription as string;
      const stripeSub = await this.stripe.getSubscription(stripeSubId);
      const currentPeriodEnd = stripeSub.current_period_end
        ? new Date(stripeSub.current_period_end * 1000)
        : this.oneMonthFromNow();
      const invoiceId = stripeSub.latest_invoice as string | null;

      // 🔒 Trial: se o Stripe criou a subscription em trialing (trial_period_days=7),
      // o status no Stripe é 'trialing' — mapeamos para 'trialing' no DB
      // em vez de 'active' para o isActive verificar trialUntil.
      const isTrialing = stripeSub.status === 'trialing';
      const trialEnd = stripeSub.trial_end
        ? new Date(stripeSub.trial_end * 1000)
        : null;

      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: isTrialing ? 'trialing' : 'active',
          externalId: stripeSubId,
          lastPaymentId: invoiceId,
          startsAt: new Date(),
          expiresAt: currentPeriodEnd,
          trialUntil: trialEnd,
        },
      });
    } else if (session.mode === 'payment') {
      // Pagamento único: ativa por 1 mês.
      // Em modo payment, payment_intent está disponível normalmente.
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
   *
   * 🔒 P3: Se o webhook customer.subscription.updated chegar ANTES do
   * checkout.session.completed (Stripe não garante ordem), o externalId no DB
   * ainda é cs_... e não sub_... — findUnique por externalId retorna null.
   * Faz fallback usando o tenantId do metadata da subscription do Stripe.
   */
  private async handleSubscriptionUpdate(stripeSubscription: Stripe.Subscription) {
    // Busca direta pelo externalId (fluxo normal — checkout já processado)
    let subscription = await this.prisma.subscription.findUnique({
      where: { externalId: stripeSubscription.id },
    });

    // Fallback: se o checkout.session.completed ainda não rodou, externalId
    // no DB ainda é o session ID. Usa o tenantId do metadata para encontrar.
    if (!subscription) {
      const tenantId = stripeSubscription.metadata?.tenantId;
      if (tenantId) {
        subscription = await this.prisma.subscription.findFirst({
          where: { tenantId, status: { in: ['pending', 'active', 'trialing'] } },
          orderBy: { createdAt: 'desc' },
        });
      }
    }

    if (!subscription) {
      this.logger.warn(`Nenhuma subscription local para Stripe sub ${stripeSubscription.id}`);
      return;
    }

    const status = this.mapStripeStatus(stripeSubscription.status);
    const currentPeriodEnd = stripeSubscription.current_period_end
      ? new Date(stripeSubscription.current_period_end * 1000)
      : null;

    // 🔒 P6: Se o Stripe envia status trialing, preserva trialUntil a partir
    // do trial_end do Stripe em vez de fundir trialing → active sem trialUntil.
    const trialEnd = stripeSubscription.trial_end
      ? new Date(stripeSubscription.trial_end * 1000)
      : null;

    // Constrói o update dinamicamente — só sobrescreve expiresAt e trialUntil
    // se o Stripe enviou valores reais, evitando dessincronizar o que o
    // checkout.session.completed já setou corretamente.
    const updateData: Record<string, unknown> = {
      status,
      // Se encontrou via fallback, sincroniza o externalId para o sub_ ID correto
      ...(subscription.externalId !== stripeSubscription.id && {
        externalId: stripeSubscription.id,
      }),
    };

    if (currentPeriodEnd) {
      updateData.expiresAt = currentPeriodEnd;
    }

    if (trialEnd) {
      updateData.trialUntil = trialEnd;
    } else if (stripeSubscription.status === 'canceled') {
      // Limpa trialOnly quando a subscription é cancelada
      updateData.trialUntil = null;
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: updateData as any,
    });
  }

  private mapStripeStatus(stripeStatus: string): string {
    switch (stripeStatus) {
      case 'active':
        return 'active';
      case 'trialing':
        return 'trialing';
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
