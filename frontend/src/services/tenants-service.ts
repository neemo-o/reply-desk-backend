import { apiClient } from "./api-client";
import type { TenantMember } from "@/types/billing";

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  status: string;
  createdAt: string;
}

export const tenantsService = {
  async findMine(): Promise<TenantSummary[]> {
    const { data } = await apiClient.get<TenantSummary[]>("/tenants/mine");
    return data;
  },

  async listMembers(): Promise<TenantMember[]> {
    const { data } = await apiClient.get<TenantMember[]>("/tenants/members");
    return data;
  },
};
