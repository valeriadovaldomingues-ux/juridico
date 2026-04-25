import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['gerente', 'socio']

/** GET /api/automations/runs?limit=50&offset=0 — histórico de execuções */
export async function GET(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '50'), 200)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('automation_runs')
    .select(`
      *,
      automation:automations!automation_id(name)
    `)
    .order('executed_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
