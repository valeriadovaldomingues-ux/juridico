import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { registrarLogHonorario } from '@/lib/honorarios/audit'

// POST /api/financeiro/honorarios/extras/[id]/cancelar
// Cancela o honorário avulso e suas parcelas ainda não pagas.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID ausente' }, { status: 400 })

  const supabase = await createClient()
  const { data: extra } = await supabase
    .from('honorarios_extras').select('id, status').eq('id', id).single()
  if (!extra) return NextResponse.json({ error: 'Honorário extra não encontrado' }, { status: 404 })
  if (extra.status === 'cancelado') return NextResponse.json({ error: 'Já cancelado' }, { status: 409 })

  // Cancela o cabeçalho.
  const { error: errE } = await supabase
    .from('honorarios_extras').update({ status: 'cancelado' }).eq('id', id)
  if (errE) return NextResponse.json({ error: errE.message }, { status: 400 })

  // Cancela as parcelas ainda não pagas (paga preserva histórico).
  await supabase
    .from('honorarios_mensais')
    .update({ cancelado: true, cancelado_em: new Date().toISOString(), cancelado_por: auth.userId })
    .eq('extra_id', id)
    .eq('cancelado', false)
    .neq('status', 'pago')

  await registrarLogHonorario(supabase, {
    extra_id: id,
    acao: 'cancelado',
    detalhes: {},
  }, auth.userId)

  return NextResponse.json({ id, cancelado: true })
}
