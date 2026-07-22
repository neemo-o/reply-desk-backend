import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthTokens, User } from "@/types/auth";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (tokens: AuthTokens, user?: User | null) => void;
  setUser: (user: User | null) => void;
  clearSession: () => void;
}

/**
 * Fonte de verdade persistida da sessão (token + usuário).
 * Fica fora do React para que o axios interceptor (fora da árvore de
 * componentes) consiga ler/gravar tokens sem precisar de contexto.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: (tokens, user) =>
        set((state) => ({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: user !== undefined ? user : state.user,
        })),
      setUser: (user) => set({ user }),
      clearSession: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: "replydesk-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
