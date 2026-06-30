import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { COBRANCAS_SELECT, statusForDueDate } from '@/lib/cobrancas'
import { createSupabaseCobrancasStore } from '@/lib/cobrancas-store'
import { createSingleCobrancaAction } from '@/lib/cobrancas-workflow'

const ALLOWED = ['administrativo', 'gerente', 'socio'] as const

export async function GET(req: NextRequest) {
  const auth = await apiGuard([...ALLOWED])
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const clienteId = searchParams.get('cliente_id')
  const mes = searchParams.get('mes')

  let query = supabase
    .from('cobrancas')
    .select(COBRANCAS_SELECT)
    .order('data_vencimento', { ascending: false })
    .limit(500)

  if (status) query = query.eq('status', status)
  if (clienteId) query = query.eq('cliente_id', clienteId)
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    query = query.gte('data_vencimento', `${mes}-01`).lt('data_vencimento', nextMonth(mes))
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json((data ?? []).map(item => ({
    ...item,
    status: statusForDueDate(item.status, item.data_vencimento),
  })))
}

export async function POST(req: NextRequest) {
  const auth = await apiGuard([...ALLOWED])
  if (auth instanceof NextResponse) return auth

  const supabase = createServiceClient()
  const store = createSupabaseCobrancasStore(supabase)
  const result = await createSingleCobrancaAction({
    role: auth.role,
    userId: auth.userId,
    store,
    body: await req.json(),
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.data, { status: result.status })
}

function nextMonth(yyyyMm: string) {
  const [year, month] = yyyyMm.split('-').map(Number)
  const date = new Date(year, month, 1)
  return date.toISOString().slice(0, 10)
}
