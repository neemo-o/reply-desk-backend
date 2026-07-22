import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/contexts/auth-store";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1";

export const apiClient = axios.create({
  baseURL: API_URL,
});

apiClient.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setSession, clearSession } = useAuthStore.getState();
  if (!refreshToken) return null;

  try {
    const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
      `${API_URL}/auth/refresh`,
      { refreshToken },
    );
    setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data.accessToken;
  } catch {
    clearSession();
    return null;
  }
}

// 🔁 Em caso de 401, tenta renovar a sessão via refresh token uma única vez
// (evitando corridas concorrentes) antes de repetir a requisição original.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableConfig | undefined;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/")
    ) {
      originalRequest._retry = true;

      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });

      const newAccessToken = await refreshPromise;

      if (newAccessToken) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      }
    }

    return Promise.reject(error);
  },
);
