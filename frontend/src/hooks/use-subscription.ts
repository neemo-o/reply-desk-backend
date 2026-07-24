import { useQuery } from "@tanstack/react-query";
import { subscriptionsService } from "@/services/subscriptions-service";
import { useAuth } from "@/contexts/auth-provider";

export function useSubscription() {
  const { isAuthenticated, tenant } = useAuth();

  return useQuery({
    queryKey: ["subscriptions", "me", tenant?.id],
    queryFn: () => subscriptionsService.getCurrent(),
    enabled: isAuthenticated && Boolean(tenant),
  });
}
