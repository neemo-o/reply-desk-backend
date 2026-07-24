import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/auth-provider";
import { FullscreenLoader } from "@/components/layout/fullscreen-loader";

export function ProtectedRoute() {
  const { isAuthenticated, isInitializing, user } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return <FullscreenLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Bloqueia qualquer rota protegida até o e-mail ser confirmado — exceto a
  // própria tela de verificação.
  if (user && !user.emailVerified && location.pathname !== "/verify-email") {
    return <Navigate to="/verify-email" replace />;
  }

  return <Outlet />;
}
