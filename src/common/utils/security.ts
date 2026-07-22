/**
 * Utilitários de segurança compartilhados.
 *
 * 🔒 S2 — Validação UUID v4 para headers de tenant.
 * 🔒 S12 — Helpers para bloqueio de SSRF em URLs externas.
 */

// UUID v1-v7 (case-insensitive). Pode ser ajustado para uma versão específica se quiser.
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

// Hosts reservadas / privadas — usados pelo validador SSRF do webhook.
const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  '169.254.169.254', // AWS / GCP metadata
  'metadata.google.internal',
  'metadata.azure.com',
]);

const PRIVATE_IPV4_RANGES: RegExp[] = [
  /^10\./,
  /^127\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./, // CGNAT / shared address space
];

function isPrivateIPv4(host: string): boolean {
  return PRIVATE_IPV4_RANGES.some((re) => re.test(host));
}

/**
 * 🔒 S12 — Verifica se uma URL é pública e HTTPS.
 * Bloqueia loopback, IPs privados e metadata services.
 */
export function isPublicHttpsUrl(rawUrl: unknown): boolean {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) return false;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  if (!host) return false;
  if (BLOCKED_HOSTS.has(host)) return false;
  if (isPrivateIPv4(host)) return false;
  if (host.endsWith('.local') || host.endsWith('.internal')) return false;
  return true;
}

/**
 * Extrai o payload expires em segundos a partir de uma string tipo "15m", "7d", "3600".
 * Suporta: s, m, h, d. Default = 7 dias.
 */
export function parseExpiresInToMs(value: string | undefined | null): number {
  if (!value || typeof value !== 'string') return 7 * 24 * 60 * 60 * 1000;
  const match = value.trim().match(/^(\d+)\s*([smhd])$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const mult: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * mult[unit];
}
