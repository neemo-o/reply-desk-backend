import { isAxiosError, type AxiosError } from "axios";

/**
 * Extrai uma string de erro humanamente legível de um erro Axios, aceitando
 * qualquer formato razoável que o backend NestJS possa retornar:
 *
 * - { message: "string" }
 * - { message: ["erro 1", "erro 2"] }  (ValidationPipe)
 * - { message: { message: "...", error: "..." } }  (logger bugado — não crashe)
 * - { error: "string", statusCode: 400 }
 * - string pura
 *
 * Garante que o resultado seja sempre uma `string`, nunca um objeto/array,
 * porque sonner/React não renderiza objetos como children.
 */
export function extractApiErrorMessage(
  error: unknown,
  fallback = "Não foi possível completar a operação. Tente novamente.",
): string {
  if (!isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  const axiosErr = error as AxiosError<unknown>;
  const data = axiosErr.response?.data;
  if (!data) {
    if (axiosErr.request) {
      return "Sem resposta do servidor. Verifique sua conexão e tente novamente.";
    }
    return axiosErr.message || fallback;
  }

  return normalizeMessage(data) ?? fallback;
}

function normalizeMessage(data: unknown): string | null {
  if (typeof data === "string") return data;

  if (Array.isArray(data)) {
    return data.map((item) => normalizeMessage(item) ?? "").filter(Boolean).join("; ");
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;

    if (typeof obj.message === "string") return obj.message;
    if (Array.isArray(obj.message)) {
      return obj.message
        .map((item) => (typeof item === "string" ? item : normalizeMessage(item)))
        .filter(Boolean)
        .join("; ");
    }
    if (obj.message && typeof obj.message === "object") {
      // Encadeado (legado/bugado): recursa uma vez.
      return normalizeMessage(obj.message);
    }
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.detail === "string") return obj.detail;
  }

  return null;
}
