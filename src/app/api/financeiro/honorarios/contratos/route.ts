import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'

const SELECT = '*, cliente:clientes(id, nome)'

// GET /api/financeiro/honorarios/contratos
export async function GET() {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('honorarios_contratos')
    .select(SELECT)
    .order('status', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contratos: data ?? [] })
}

// POST /api/financeiro/honorarios/contratos
export async function POST(req: NextRequest) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  if (!body.cliente_id) return NextResponse.json({ error: 'cliente_id é obrigatório' }, { status: 400 })
  if (body.valor_mensal === undefined) return NextResponse.json({ error: 'valor_mensal é obrigatório' }, { status: 400 })

  const dia = Number(body.dia_vencimento) || 10
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('honorarios_contratos')
    .insert({
      cliente_id:     body.cliente_id,
      valor_mensal:   Number(body.valor_mensal) || 0,
      dia_vencimento: Math.min(Math.max(dia, 1), 31),
      isento:         Boolean(body.isento),
      status:         body.status || 'ativo',
      data_inicio:    body.data_inicio || new Date().toISOString().slice(0, 10),
      data_fim:       body.data_fim || null,
      observacoes:    body.observacoes || null,
      criado_por:     auth.userId,
    })
    .select(SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
