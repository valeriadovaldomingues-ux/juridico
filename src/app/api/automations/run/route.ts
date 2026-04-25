import { NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { runAutomationEngine } from '@/lib/automations/engine'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['gerente', 'socio']

/**
 * POST /api/automations/run
 *
 * Executa o motor de automações.
 * Em produção, chame este endpoint via cron (Vercel Cron, pg_cron, etc.)
 * Também pode ser acionado manualmente pela UI.
 */
export async function POST() {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  try {
    const result = await runAutomationEngine()
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
