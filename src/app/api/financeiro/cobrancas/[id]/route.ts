import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { COBRANCAS_SELECT, addCobrancaEvento, assertProcessoBelongsToCliente, logCobranca, normalizeCobrancaInput, statusForDueDate } from '@/lib/cobrancas'
import { createSupabaseCobrancasStore } from '@/lib/cobrancas-store'
import { deleteCobrancaAction } from '@/lib/cobrancas-workflow'

const ALLOWED = ['administrativo', 'gerente', 'socio'] as const

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard([...ALLOWED])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cobrancas')
    .select(COBRANCAS_SELECT)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ ...data, status: statusForDueDate(data.status, data.data_vencimento) })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard([...ALLOWED])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = createServiceClient()
  const body = await req.json()

  const { data: atual, error: currentError } = await supabase
    .from('cobrancas')
    .select('id, status')
    .eq('id', id)
    .single()

  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 404 })
  if (atual.status === 'paga') {
    return NextResponse.json({ error: 'Cobranca paga nao pode ser alterada.' }, { status: 409 })
  }

  let input
  try {
    input = normalizeCobrancaInput(body)
    await assertProcessoBelongsToCliente(supabase, input.cliente_id, input.processo_id)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Dados invalidos.' }, { status: 400 })
  }

  const nextStatus = body.status === 'cancelada' ? 'cancelada' : statusForDueDate(body.status ?? atual.status, input.data_vencimento)
  const { data, error } = await supabase
    .from('cobrancas')
    .update({ ...input, status: nextStatus })
    .eq('id', id)
    .select(COBRANCAS_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await addCobrancaEvento(supabase, {
    cobranca_id: id,
    tipo: 'atualizacao_manual',
    status_anterior: atual.status,
    status_novo: data.status,
    payload: input,
    created_by: auth.userId,
  })
  await logCobranca(supabase, {
    cobranca_id: id,
    acao: data.status === 'cancelada' ? 'cancelamento' : 'atualizacao_cobranca',
    payload: input,
    usuario_id: auth.userId,
    ip: req.headers.get('x-forwarded-for'),
    user_agent: req.headers.get('user-agent'),
  })

  return NextResponse.json(data)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = createServiceClient()
  const store = createSupabaseCobrancasStore(supabase)
  const body = await req.json().catch(() => ({}))
  const result = await deleteCobrancaAction({
    role: auth.role,
    userId: auth.userId,
    store,
    id,
    motivo: typeof body.motivo === 'string' ? body.motivo : null,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.data, { status: result.status })
}
