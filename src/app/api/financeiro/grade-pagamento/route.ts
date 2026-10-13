import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { financeiroLiberadoPorUsuario } from '@/lib/auth/financeiro-acesso'

export async function GET() {
  const auth = await apiGuard(['gerente', 'socio', 'administrativo'])
  if (auth instanceof NextResponse) return auth
  if (auth.role === 'administrativo' && !financeiroLiberadoPorUsuario(auth.userId)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('grade_pagamento_clientes')
    .select('id, cliente_id, valor_mensal, forma_pagamento, status, observacoes, updated_at, cliente:clientes(id, nome)')
    .order('cliente(nome)')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const auth = await apiGuard(['gerente', 'socio', 'administrativo'])
  if (auth instanceof NextResponse) return auth
  if (auth.role === 'administrativo' && !financeiroLiberadoPorUsuario(auth.userId)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

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
