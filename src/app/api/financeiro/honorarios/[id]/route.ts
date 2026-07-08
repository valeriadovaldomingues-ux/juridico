import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { HONORARIO_STATUS } from '@/lib/honorarios/types'
import { registrarLogHonorario } from '@/lib/honorarios/audit'
import { competenciaFechada } from '@/lib/honorarios/guards'

const SELECT = '*, cliente:clientes(id, nome), responsavel:profiles!responsavel_lancamento_id(id, nome)'

// PATCH /api/financeiro/honorarios/[id] — edição inline (com auditoria + freeze)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID ausente' }, { status: 400 })

  const supabase = await createClient()

  // Estado atual (para auditoria + checagem de mês fechado).
  const { data: atual } = await supabase
    .from('honorarios_mensais')
    .select('competencia, valor_pago, status, cancelado')
    .eq('id', id)
    .single()
  if (!atual) return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 })
  if (atual.cancelado) return NextResponse.json({ error: 'Registro cancelado não pode ser editado' }, { status: 409 })
  if (await competenciaFechada(supabase, atual.competencia as string)) {
    return NextResponse.json({ error: 'Mês fechado: registro congelado para histórico.' }, { status: 409 })
  }

  const body = await req.json()
  const update: Record<string, unknown> = { responsavel_lancamento_id: auth.userId }

  if (body.status !== undefined) {
    if (!HONORARIO_STATUS.includes(body.status)) {
      return NextResponse.json({ error: 'status inválido' }, { status: 400 })
    }
    update.status = body.status
  }
  if (body.valor_pago !== undefined)      update.valor_pago = Number(body.valor_pago) || 0
  if (body.valor_devido !== undefined)    update.valor_devido = Number(body.valor_devido) || 0
  if (body.saldo_anterior !== undefined)  update.saldo_anterior = Number(body.saldo_anterior) || 0
  if (body.vencimento !== undefined)      update.vencimento = body.vencimento || null
  if (body.data_pagamento !== undefined)  update.data_pagamento = body.data_pagamento || null
  if (body.forma_pagamento !== undefined) update.forma_pagamento = body.forma_pagamento || null
  if (body.observacoes !== undefined)     update.observacoes = body.observacoes || null
  if (body.arquivado !== undefined)       update.arquivado = Boolean(body.arquivado)

  const { data, error } = await supabase
    .from('honorarios_mensais')
    .update(update)
    .eq('id', id)
    .select(SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrarLogHonorario(supabase, {
    registro_id: id,
    acao: body.status === 'pago' ? 'pago' : 'editado',
    detalhes: { campos: Object.keys(update).filter(k => k !== 'responsavel_lancamento_id') },
    valor_anterior: atual.valor_pago as number,
    status_anterior: atual.status as string,
  }, auth.userId)

  return NextResponse.json(data)
}
