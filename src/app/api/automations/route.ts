import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['gerente', 'socio']

/** GET /api/automations — lista todas as automações com estatísticas */
export async function GET() {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()

  // Automações com última execução e total de execuções (via subquery via RPC seria ideal,
  // mas por simplicidade fazemos duas queries e fundimos no servidor)
  const [{ data: automations, error }, { data: runStats }] = await Promise.all([
    supabase.from('automations').select('*').order('created_at', { ascending: true }),
    supabase
      .from('automation_runs')
      .select('automation_id, executed_at, status')
      .order('executed_at', { ascending: false }),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Montar estatísticas por automation_id
  const statsMap = new Map<string, { last_run_at: string; total_runs: number }>()
  for (const run of runStats ?? []) {
    if (!run.automation_id) continue
    const existing = statsMap.get(run.automation_id)
    if (!existing) {
      statsMap.set(run.automation_id, { last_run_at: run.executed_at, total_runs: 1 })
    } else {
      existing.total_runs++
      if (run.executed_at > existing.last_run_at) existing.last_run_at = run.executed_at
    }
  }

  const enriched = (automations ?? []).map(a => ({
    ...a,
    last_run_at: statsMap.get(a.id)?.last_run_at ?? null,
    total_runs:  statsMap.get(a.id)?.total_runs  ?? 0,
  }))

  return NextResponse.json(enriched)
}
