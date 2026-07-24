import { useQuery } from "@tanstack/react-query";
import { usersService } from "@/services/users-service";
import { useAuth } from "@/contexts/auth-provider";

export function useProfile() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ["users", "me"],
    queryFn: () => usersService.me(),
    enabled: isAuthenticated,
  });
}
