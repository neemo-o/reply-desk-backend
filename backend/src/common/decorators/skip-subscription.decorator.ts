import { SetMetadata } from '@nestjs/common';

/**
 * 🔒 M6 — Marca uma rota/controller para NÃO passar pelo SubscriptionGuard global.
 *
 * O SubscriptionGuard é registrado como APP_GUARD global (após JwtAuthGuard e
 * TenantGuard). Por padrão, toda rota autenticada precisa ter assinatura ativa.
 * Rotas que não precisam (ou não podem precisar) de assinatura são marcadas com
 * @SkipSubscription():
 *
 *   - auth/* (login, register, verify-email, /auth/me) — usuário pode não ter tenant ainda
 *   - tenants/create, tenants/mine — usuário criando/listando tenants
 *   - subscriptions/* — criar checkout, upgrade, cancelar (mas precisa ter assinatura para upgrade)
 *   - plans — listagem pública
 *   - health — healthcheck
 *   - webhooks/stripe — endpoint do Stripe (público)
 *   - users/me — dados do próprio usuário (não ativos a uma tenant necessariamente)
 */
export const SKIP_SUBSCRIPTION_KEY = 'skipSubscription';
export const SkipSubscription = () => SetMetadata(SKIP_SUBSCRIPTION_KEY, true);
