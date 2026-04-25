import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard(['gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID ausente' }, { status: 400 })

  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('financeiro_lancamentos')
    .update({
      tipo:         body.tipo,
      categoria:    body.categoria || 'Geral',
      descricao:    body.descricao,
      valor:        Number(body.valor),
      vencimento:   body.vencimento,
      pagamento_em: body.pagamento_em || null,
      cliente_id:   body.cliente_id  || null,
      processo_id:  body.processo_id || null,
      status:       body.status,
      centro_custo: body.centro_custo || null,
    })
    .eq('id', id)
    .select('*, cliente:clientes(id, nome), processo:processos(id, numero_processo, titulo)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID ausente' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('financeiro_lancamentos')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
