/**
 * Rate limiting para o portal do cliente.
 *
 * Usa Upstash Redis quando UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * estão configurados.
 *
 * Fallback: sem Upstash configurado → limiter retorna always-allowed.
 * Neste caso, confiar no rate limiting nativo do Supabase para OTP
 * e nas validações de payload para os demais endpoints.
 *
 * Setup Upstash:
 *   1. Criar conta em https://console.upstash.com
 *   2. Criar database Redis (região us-east-1 ou similar)
 *   3. Copiar REST URL e REST Token
 *   4. Adicionar ao .env.local:
 *        UPSTASH_REDIS_REST_URL=https://...
 *        UPSTASH_REDIS_REST_TOKEN=...
 *   5. Adicionar às variáveis de ambiente do Vercel (não NEXT_PUBLIC)
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis }     from '@upstash/redis'

// ── Factory ───────────────────────────────────────────────────────────────────

function buildRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

const redis = buildRedis()

if (!redis && process.env.NODE_ENV === 'production') {
  // Avisa em produção se Upstash não está configurado
  console.warn(
    '[portal/rate-limit] UPSTASH_REDIS_REST_URL não configurado. ' +
    'Rate limiting desativado. Configure Upstash para produção.',
  )
}

// ── Limiters pré-configurados ─────────────────────────────────────────────────

/** OTP magic link: 3 por hora por email, 5 por hora por IP */
export const otpByEmail = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 h'),  prefix: 'rl:otp:email' })
  : null

export const otpByIp = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 h'),  prefix: 'rl:otp:ip' })
  : null

/** Mensagens: 30 por hora por usuário, 60 por hora por IP */
export const mensagensByUser = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 h'), prefix: 'rl:msg:user' })
  : null

export const mensagensByIp = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 h'), prefix: 'rl:msg:ip' })
  : null

/** Downloads: 100 por hora por usuário */
export const downloadByUser = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '1 h'), prefix: 'rl:dl:user' })
  : null

/** Access-log: 120 por minuto por usuário (log events são frequentes) */
export const accessLogByUser = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, '1 m'), prefix: 'rl:log:user' })
  : null

// ── Helper ────────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed:    boolean
  remaining?: number
  reset?:     number  // unix timestamp ms
}

/**
 * Verifica rate limit para um limiter e identificador.
 * Retorna { allowed: true } se Upstash não está configurado (sem limiter).
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<RateLimitResult> {
  if (!limiter) return { allowed: true }
  const result = await limiter.limit(identifier)
  return {
    allowed:   result.success,
    remaining: result.remaining,
    reset:     result.reset,
  }
}
