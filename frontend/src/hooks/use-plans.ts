import { useQuery } from "@tanstack/react-query";
import { subscriptionsService } from "@/services/subscriptions-service";

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: () => subscriptionsService.listPlans(),
    staleTime: 5 * 60_000,
  });
}
