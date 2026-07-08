import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { registrarLogHonorario } from '@/lib/honorarios/audit'
import { competenciaFechada } from '@/lib/honorarios/guards'

const SELECT = '*, cliente:clientes(id, nome), responsavel:profiles!responsavel_lancamento_id(id, nome)'

// POST /api/financeiro/honorarios/[id]/cancelar — cancelamento (sem exclusão definitiva)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID ausente' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const supabase = await createClient()

  const { data: atual } = await supabase
    .from('honorarios_mensais')
    .select('competencia, status, valor_pago, cancelado')
    .eq('id', id)
    .single()
  if (!atual) return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 })
  if (atual.cancelado) return NextResponse.json({ error: 'Registro já cancelado' }, { status: 409 })
  if (await competenciaFechada(supabase, atual.competencia as string)) {
    return NextResponse.json({ error: 'Mês fechado: registro congelado para histórico.' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('honorarios_mensais')
    .update({ cancelado: true, cancelado_em: new Date().toISOString(), cancelado_por: auth.userId })
    .eq('id', id)
    .select(SELECT)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrarLogHonorario(supabase, {
    registro_id: id,
    acao: 'cancelado',
    detalhes: { motivo: body.motivo ?? null },
    valor_anterior: atual.valor_pago as number,
    status_anterior: atual.status as string,
  }, auth.userId)

  return NextResponse.json(data)
}
