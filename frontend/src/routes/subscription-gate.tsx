import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/auth-provider";
import { useSubscription } from "@/hooks/use-subscription";
import { FullscreenLoader } from "@/components/layout/fullscreen-loader";

/**
 * Protege as rotas do dashboard: só libera acesso se o tenant tiver uma
 * assinatura ativa (active/trialing dentro da validade). Caso contrário,
 * redireciona para a escolha de plano ou para o acompanhamento do pagamento
 * (quando já existe um checkout criado, aguardando confirmação do webhook).
 */
export function SubscriptionGate() {
  const { tenant } = useAuth();
  const { data: subscription, isLoading } = useSubscription();

  if (!tenant) {
    return <Navigate to="/choose-plan" replace />;
  }

  if (isLoading) {
    return <FullscreenLoader />;
  }

  if (!subscription) {
    return <Navigate to="/choose-plan" replace />;
  }

  if (subscription.status === "pending") {
    return <Navigate to="/payment/callback" replace />;
  }

  if (!subscription.isActive) {
    return <Navigate to="/choose-plan" replace />;
  }

  return <Outlet />;
}
