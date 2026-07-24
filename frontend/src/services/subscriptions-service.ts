import { apiClient } from "./api-client";
import type { BillingType, CheckoutResult, Plan, Subscription } from "@/types/billing";

export const subscriptionsService = {
  async listPlans(): Promise<Plan[]> {
    const { data } = await apiClient.get<Plan[]>("/plans");
    return data;
  },

  async getCurrent(): Promise<Subscription | null> {
    const { data } = await apiClient.get<Subscription | null>("/subscriptions/me");
    return data;
  },

  async createCheckout(planId: string, billingType: BillingType = "recurring"): Promise<CheckoutResult> {
    const { data } = await apiClient.post<CheckoutResult>("/subscriptions/checkout", {
      planId,
      billingType,
    });
    return data;
  },

  async upgradePlan(planId: string): Promise<Subscription> {
    const { data } = await apiClient.patch<Subscription>("/subscriptions/upgrade", { planId });
    return data;
  },

  async cancel(): Promise<void> {
    await apiClient.delete("/subscriptions/cancel");
  },
};
