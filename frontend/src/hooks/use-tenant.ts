import { useQuery } from "@tanstack/react-query";
import { tenantsService } from "@/services/tenants-service";
import { useAuth } from "@/contexts/auth-provider";

export function useTenantSummary() {
  const { isAuthenticated, tenant } = useAuth();

  return useQuery({
    queryKey: ["tenants", "mine", tenant?.id],
    queryFn: async () => {
      const tenants = await tenantsService.findMine();
      return tenants.find((t) => t.id === tenant?.id) ?? tenants[0] ?? null;
    },
    enabled: isAuthenticated && Boolean(tenant),
  });
}

export function useTenantMembers() {
  const { isAuthenticated, tenant } = useAuth();

  return useQuery({
    queryKey: ["tenants", "members", tenant?.id],
    queryFn: () => tenantsService.listMembers(),
    enabled: isAuthenticated && Boolean(tenant),
  });
}
