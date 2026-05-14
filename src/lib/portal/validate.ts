/**
 * Utilitários de validação para o portal do cliente.
 * Centraliza todas as verificações de input antes que cheguem ao banco.
 */

// ── UUID ──────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Retorna true se o valor é uma string no formato UUID v4 */
export function isUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** Valida UUID e retorna erro 400 se inválido */
export function requireUUID(
  value: unknown,
  fieldName: string,
): { ok: true; value: string } | { ok: false; error: string } {
  if (!isUUID(value)) {
    return { ok: false, error: `${fieldName}: formato UUID inválido` }
  }
  return { ok: true, value }
}

// ── Content-Length / Payload ──────────────────────────────────────────────────

export const LIMITS = {
  BODY_BYTES:    32 * 1024,  // 32 KB — body JSON total
  MENSAGEM_CHARS: 4_000,     // 4 000 chars — conteúdo de mensagem
  USER_AGENT:      512,      // 512 chars — user-agent header
  TITULO_CHARS:    200,      // 200 chars — títulos genéricos
} as const

/**
 * Verifica o header Content-Length do request.
 * Retorna null se OK, ou uma mensagem de erro se excede o limite.
 */
export function checkContentLength(
  request: Request,
  maxBytes = LIMITS.BODY_BYTES,
): string | null {
  const len = request.headers.get('content-length')
  if (len !== null && parseInt(len, 10) > maxBytes) {
    return `Payload muito grande (máximo ${maxBytes} bytes)`
  }
  return null
}

/**
 * Valida o comprimento de uma string contra um limite máximo.
 * Retorna null se OK, ou uma mensagem de erro se excede.
 */
export function checkStringLength(
  value: string,
  maxLength: number,
  fieldName: string,
): string | null {
  if (value.length > maxLength) {
    return `${fieldName} excede o limite de ${maxLength} caracteres`
  }
  return null
}

// ── IP ────────────────────────────────────────────────────────────────────────

/**
 * Extrai o IP real do request a partir de headers confiáveis.
 * Usa apenas o PRIMEIRO valor de x-forwarded-for (IP do cliente real,
 * adicionado pelo primeiro proxy — não falsificável pelo cliente quando
 * há um reverse proxy confiável na frente).
 * Fallback para x-real-ip (Nginx, Vercel).
 */
export function extractIP(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim() || null
  }
  return request.headers.get('x-real-ip')
}

/**
 * Trunca o user-agent ao limite seguro para armazenamento.
 */
export function truncateUserAgent(ua: string | null): string | null {
  if (!ua) return null
  return ua.slice(0, LIMITS.USER_AGENT)
}
