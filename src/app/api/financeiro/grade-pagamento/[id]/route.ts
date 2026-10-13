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

  const body = await req.json()
  const supabase = await createClient()

  const patch: Record<string, unknown> = {}
  if ('status' in body)          patch.status = body.status
  if ('valor_mensal' in body)    patch.valor_mensal = body.valor_mensal === '' ? null : Number(body.valor_mensal)
  if ('forma_pagamento' in body) patch.forma_pagamento = body.forma_pagamento || null
  if ('observacoes' in body)     patch.observacoes = body.observacoes || null

  const { data, error } = await supabase
    .from('grade_pagamento_clientes')
    .update(patch)
    .eq('id', id)
    .select('id, cliente_id, valor_mensal, forma_pagamento, status, observacoes, updated_at, cliente:clientes(id, nome)')
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
  const { error } = await supabase.from('grade_pagamento_clientes').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
