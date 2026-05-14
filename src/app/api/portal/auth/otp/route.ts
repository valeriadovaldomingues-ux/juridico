/**
 * POST /api/portal/auth/otp
 *
 * Wrapper server-side para o magic link do portal.
 * Controla:
 *   - Rate limiting por email (3/hora) e por IP (5/hora)
 *   - Normalização de timing (~800ms) para mitigar timing attacks
 *   - Nunca revela se o email existe ou não no sistema
 *   - Log de bloqueios por rate limit
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkOrigin } from '@/lib/portal/origin'
import { checkContentLength, extractIP } from '@/lib/portal/validate'
import { otpByEmail, otpByIp, checkRateLimit } from '@/lib/portal/rate-limit'

const MIN_RESPONSE_MS = 800  // normaliza timing para prevenir enumeração

export async function POST(request: NextRequest) {
  const started = Date.now()

  // ── 1. CSRF / Origin ────────────────────────────────────────────────────────
  const originBlocked = checkOrigin(request)
  if (originBlocked) return originBlocked

  // ── 2. Tamanho do payload ───────────────────────────────────────────────────
  const sizeError = checkContentLength(request)
  if (sizeError) {
    return NextResponse.json({ error: sizeError }, { status: 413 })
  }

  // ── 3. Parse do body ────────────────────────────────────────────────────────
  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    await normalizeDelay(started)
    // Retorna 200 mesmo com email inválido para não revelar informação
    return NextResponse.json({ success: true })
  }

  // ── 4. Rate limiting ────────────────────────────────────────────────────────
  const ip = extractIP(request) ?? 'unknown'

  const [byEmail, byIp] = await Promise.all([
    checkRateLimit(otpByEmail, email),
    checkRateLimit(otpByIp,    ip),
  ])

  if (!byEmail.allowed || !byIp.allowed) {
    const key   = !byEmail.allowed ? `email:${email}` : `ip:${ip}`
    const reset = byEmail.allowed ? byIp.reset : byEmail.reset

    console.warn(`[portal/otp] Rate limit atingido — ${key}`)

    await normalizeDelay(started)
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde e tente novamente.' },
      {
        status:  429,
        headers: reset ? { 'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)) } : {},
      },
    )
  }

  // ── 5. Dispara o magic link ─────────────────────────────────────────────────
  const supabase = await createClient()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl}/portal`,
      shouldCreateUser: false,
    },
  })
  // Não inspecionamos o error — sempre retornamos sucesso para não revelar
  // se o email está cadastrado (enumeração de usuários)

  // ── 6. Normaliza timing ─────────────────────────────────────────────────────
  await normalizeDelay(started)
  return NextResponse.json({ success: true })
}

async function normalizeDelay(startedAt: number) {
  const elapsed = Date.now() - startedAt
  if (elapsed < MIN_RESPONSE_MS) {
    await new Promise<void>(r => setTimeout(r, MIN_RESPONSE_MS - elapsed))
  }
}
