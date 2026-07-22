import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/auth-provider";
import { FullscreenLoader } from "@/components/layout/fullscreen-loader";

export function PublicOnlyRoute() {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return <FullscreenLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
