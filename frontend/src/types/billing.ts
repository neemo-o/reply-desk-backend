export interface Plan {
  id: string;
  name: string;
  price: string | number;
  maxSessions: number;
  maxUsers: number;
  maxBots: number;
  maxMessages: number;
  maxStorageMb: number;
  maxAiRequests: number;
}

export type BillingType = "recurring" | "one_time";

export type SubscriptionStatus = "trialing" | "pending" | "active" | "past_due" | "cancelled";

export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  billingType: BillingType;
  trialUntil?: string | null;
  startsAt: string;
  expiresAt?: string | null;
  isActive: boolean;
  plan: Plan;
}

export interface CheckoutResult {
  checkoutUrl: string;
  subscriptionId: string;
  billingType: BillingType;
}

export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  status: string;
  user: { id: string; name: string; email: string };
  role: { name: string };
}
