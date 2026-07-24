import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAuthStore } from "./auth-store";
import { authService } from "@/services/auth-service";
import type { LoginPayload, RegisterPayload, User } from "@/types/auth";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, accessToken, refreshToken, setSession, setUser, clearSession } = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);

  // 🔄 Ao carregar a app, valida a sessão persistida buscando o usuário atual.
  // Se o access token estiver expirado, o interceptor do axios tenta o
  // refresh automaticamente; se falhar de vez, a sessão é limpa (logout).
  useEffect(() => {
    async function bootstrap() {
      if (!accessToken) {
        setIsInitializing(false);
        return;
      }
      try {
        const currentUser = await authService.me();
        setUser(currentUser);
      } catch {
        clearSession();
      } finally {
        setIsInitializing(false);
      }
    }
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(payload: LoginPayload) {
    const tokens = await authService.login(payload);
    setSession(tokens);
    const currentUser = await authService.me();
    setUser(currentUser);
  }

  async function register(payload: RegisterPayload) {
    const tokens = await authService.register(payload);
    setSession(tokens);
    const currentUser = await authService.me();
    setUser(currentUser);
  }

  async function logout() {
    try {
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch {
      // mesmo se a chamada falhar, limpamos a sessão local
    } finally {
      clearSession();
      toast.success("Sessão encerrada");
    }
  }

  // Usado após verificar o e-mail (ou qualquer mudança de estado do usuário no
  // backend) para atualizar `user` no contexto sem precisar de novo login.
  async function refreshUser() {
    const currentUser = await authService.me();
    setUser(currentUser);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(accessToken && user),
        isInitializing,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return ctx;
}
