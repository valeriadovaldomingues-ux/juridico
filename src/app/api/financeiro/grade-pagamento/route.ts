import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const auth = await apiGuard(['gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('grade_pagamento_clientes')
    .select('id, cliente_id, valor_mensal, forma_pagamento, status, observacoes, updated_at, cliente:clientes(id, nome)')
    .order('cliente(nome)')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const auth = await apiGuard(['gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  if (!body.cliente_id) return NextResponse.json({ error: 'cliente_id ausente' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('grade_pagamento_clientes')
    .insert({
      cliente_id:      body.cliente_id,
      valor_mensal:    body.valor_mensal ?? null,
      forma_pagamento: body.forma_pagamento ?? 'boleto',
      status:           'pendente',
    })
    .select('id, cliente_id, valor_mensal, forma_pagamento, status, observacoes, updated_at, cliente:clientes(id, nome)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
