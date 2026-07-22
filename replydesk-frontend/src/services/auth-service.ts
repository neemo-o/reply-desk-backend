import { apiClient, API_URL } from "./api-client";
import type { AuthTokens, LoginPayload, RegisterPayload, User } from "@/types/auth";

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

  async me(): Promise<User> {
    const { data } = await apiClient.get<User>("/users/me");
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
