import { apiClient, API_URL } from "./api-client";
import type { AuthTokens, LoginPayload, MeSnapshot, RegisterPayload } from "@/types/auth";

export const authService = {
  async login(payload: LoginPayload): Promise<AuthTokens> {
    const { data } = await apiClient.post<AuthTokens>("/auth/login", payload);
    return data;
  },

  async register(payload: RegisterPayload): Promise<AuthTokens> {
    const { data } = await apiClient.post<AuthTokens>("/auth/register", payload);
    return data;
  },

  async logout(refreshToken: string): Promise<void> {
    await apiClient.post("/auth/logout", { refreshToken });
  },

  /**
   * Snapshot de /auth/me: não exige header x-tenant-id (ao contrário de
   * /users/me), então é seguro chamar logo após login/registro, antes de
   * sabermos qual tenant está ativo. Traz emailVerified + tenants + assinatura.
   */
  async meSnapshot(): Promise<MeSnapshot> {
    const { data } = await apiClient.get<MeSnapshot>("/auth/me");
    return data;
  },

  async verifyEmail(code: string): Promise<void> {
    await apiClient.post("/auth/verify-email", { code });
  },

  async resendVerification(): Promise<{ retryAfterSeconds: number }> {
    const { data } = await apiClient.post<{ retryAfterSeconds: number }>(
      "/auth/resend-verification",
    );
    return data;
  },

  /**
   * Redireciona para o fluxo OAuth Google no backend.
   * ⚠️ Depende de um endpoint `GET /auth/google` (Passport GoogleStrategy)
   * que ainda não existe na API atual — precisa ser implementado no backend
   * antes deste botão funcionar de ponta a ponta.
   */
  redirectToGoogle(): void {
    window.location.href = `${API_URL}/auth/google`;
  },
};
