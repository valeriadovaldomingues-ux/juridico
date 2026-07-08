import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'

const SELECT = '*, cliente:clientes(id, nome)'

// PATCH /api/financeiro/honorarios/contratos/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID ausente' }, { status: 400 })

  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (body.valor_mensal !== undefined)   update.valor_mensal = Number(body.valor_mensal) || 0
  if (body.dia_vencimento !== undefined) update.dia_vencimento = Math.min(Math.max(Number(body.dia_vencimento) || 10, 1), 31)
  if (body.isento !== undefined)         update.isento = Boolean(body.isento)
  if (body.status !== undefined)         update.status = body.status
  if (body.data_inicio !== undefined)    update.data_inicio = body.data_inicio || null
  if (body.data_fim !== undefined)       update.data_fim = body.data_fim || null
  if (body.observacoes !== undefined)    update.observacoes = body.observacoes || null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('honorarios_contratos')
    .update(update)
    .eq('id', id)
    .select(SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// DELETE /api/financeiro/honorarios/contratos/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID ausente' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase.from('honorarios_contratos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
