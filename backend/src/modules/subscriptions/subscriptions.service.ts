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
import { MercadoPagoService } from './mercado-pago.service';

interface SubscriptionLike {
  status: string;
  trialUntil: Date | null;
  expiresAt: Date | null;
}

function isUniqueConstraintError(err: unknown): boolean {
  return !!err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002';
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mercadoPago: MercadoPagoService,
  ) {}

  /**
   * Uma assinatura é considerada ativa se:
   * - status "trialing" e o período de trial ainda não expirou; ou
   * - status "active" e não passou da data de expiração (ou não tem expiração definida).
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

  async createCheckout(tenantId: string, planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plano não encontrado');

    const owner = await this.prisma.tenantUser.findFirst({
      where: { tenantId, role: { name: 'owner' } },
      include: { user: { select: { email: true } } },
    });
    if (!owner) throw new NotFoundException('Owner do tenant não encontrado');

    const rawBackUrl = this.config.get<string>('mercadoPago.backUrl');
    if (!rawBackUrl) {
      throw new BadRequestException('MERCADOPAGO_BACK_URL não configurada');
    }

    // 🔒 P1 — Lock de advisory lock por tenant dentro de transação elimina a
    // race condition. O lock pessimista em SELECT ... FOR UPDATE falha quando
    // não existe linha ainda (primeiro checkout) — múltiplos threads viam
    // rows=[] e cada um criava uma subscription distinta.
    //
    // pg_advisory_xact_lock(hashtext(tenantId)) funciona mesmo sem linha
    // existente: o primeiro thread que chega trava o lock; os demais ficam
    // bloqueados até o commit. O lock é liberado automaticamente ao fim da
    // transação (xact = transaction-scoped).
    return this.prisma.$transaction(async (tx) => {
      // Advisory lock por tenant — serializa o checkout inteiro.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`;

      // Agora segura o lock: lê a subscription mais recente do tenant.
      const rows = await tx.$queryRaw<
        Array<{ id: string; status: string; external_id: string | null; plan_id: string }>
      >`SELECT id, status, external_id, plan_id FROM subscriptions WHERE tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT 1`;

      const current = rows[0]
        ? { id: rows[0].id, status: rows[0].status, externalId: rows[0].external_id, planId: rows[0].plan_id }
        : null;

      // Bloqueia se já tem assinatura ativa válida.
      if (current && this.isActive({ status: current.status, trialUntil: null, expiresAt: null }) && current.status === 'active') {
        throw new ConflictException('Este tenant já possui uma assinatura ativa');
      }

      // 🔒 P3 — Se já existe assinatura pending com externalId válido, reusa o
      // preapproval existente no MP e retorna seu init_point. NÃO cria um novo
      // preapproval a cada retry do usuário — isso sobrescreveria o externalId
      // e invalidaria webhooks já enviados para o preapproval anterior.
      if (current && current.status === 'pending' && current.externalId) {
        let existingPreapproval;
        try {
          existingPreapproval = await this.mercadoPago.getPreapproval(current.externalId);
        } catch {
          // Se o MP não encontra o preapproval (foi cancelado/expirou), cria novo.
          this.logger.warn(`Preapproval ${current.externalId} não encontrado no MP — criando novo`);
        }
        if (existingPreapproval && existingPreapproval.init_point) {
          // Atualiza planId caso o usuário esteja trocando de plano.
          if (current.planId !== plan.id) {
            await tx.subscription.update({
              where: { id: current.id },
              data: { planId: plan.id },
            });
          }
          return { checkoutUrl: existingPreapproval.init_point, subscriptionId: current.id };
        }
      }

      // Não há preapproval reusável — cria um novo no MP.
      const subscriptionId = current && current.status === 'pending' ? current.id : randomUUID();

      const preapproval = await this.mercadoPago.createPreapproval({
        reason: `ReplyDesk — Plano ${plan.name}`,
        externalReference: subscriptionId,
        payerEmail: owner.user.email,
        amount: Number(plan.price),
        backUrl: rawBackUrl,
      });

      await tx.subscription.upsert({
        where: { id: subscriptionId },
        update: { planId: plan.id, status: 'pending', externalId: preapproval.id },
        create: {
          id: subscriptionId,
          tenantId,
          planId: plan.id,
          status: 'pending',
          externalId: preapproval.id,
        },
      });

      return { checkoutUrl: preapproval.init_point, subscriptionId };
    });
  }

  /**
   * 🔒 Processa notificações do Mercado Pago com validação de assinatura HMAC e
   * idempotência (via PaymentWebhookEvent) — a mesma notificação pode chegar
   * mais de uma vez (retries do MP) e nunca deve ser aplicada duas vezes.
   */
  async handleWebhookNotification(
    body: Record<string, any> | undefined,
    headers: Record<string, string | undefined>,
    query: Record<string, string | undefined>,
  ) {
    const notificationId = String(body?.id ?? query.id ?? '');
    const dataId = String(body?.data?.id ?? query['data.id'] ?? '');
    const type = String(body?.type ?? query.type ?? '');

    if (!dataId) {
      throw new BadRequestException('Notificação sem data.id');
    }

    const signatureValid = this.mercadoPago.verifyWebhookSignature({
      signatureHeader: headers['x-signature'],
      requestId: headers['x-request-id'],
      dataId,
    });
    if (!signatureValid) {
      this.logger.warn(`Webhook Mercado Pago rejeitado — assinatura inválida (dataId=${dataId})`);
      throw new ForbiddenException('Assinatura inválida');
    }

    const dedupeKey = notificationId || `${type}:${dataId}`;
    try {
      await this.prisma.paymentWebhookEvent.create({
        data: { provider: 'mercadopago', externalId: dedupeKey, eventType: type },
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        this.logger.log(`Notificação ${dedupeKey} já processada — ignorada`);
        return { received: true, duplicate: true };
      }
      throw err;
    }

    if (type !== 'subscription_preapproval' && type !== 'preapproval') {
      return { received: true, ignored: true };
    }

    const subscription = await this.prisma.subscription.findUnique({ where: { externalId: dataId } });
    if (!subscription) {
      this.logger.warn(`Nenhuma subscription local encontrada para preapproval ${dataId}`);
      return { received: true, ignored: true };
    }

    const preapproval = await this.mercadoPago.getPreapproval(dataId);
    const status = this.mapMercadoPagoStatus(preapproval.status);

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status,
        lastPaymentId: dataId,
        expiresAt: status === 'active' ? this.oneMonthFromNow() : subscription.expiresAt,
      },
    });

    return { received: true };
  }

  private mapMercadoPagoStatus(mpStatus: string): string {
    switch (mpStatus) {
      case 'authorized':
        return 'active';
      case 'paused':
        return 'past_due';
      case 'cancelled':
        return 'cancelled';
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
