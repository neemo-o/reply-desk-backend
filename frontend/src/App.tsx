import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/routes/protected-route";
import { PublicOnlyRoute } from "@/routes/public-only-route";
import { LandingPage } from "@/pages/landing/landing-page";
import { LoginPage } from "@/pages/auth/login-page";
import { RegisterPage } from "@/pages/auth/register-page";
import { DashboardPage } from "@/pages/dashboard/dashboard-page";
import { NotFoundPage } from "@/pages/not-found-page";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>

      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
