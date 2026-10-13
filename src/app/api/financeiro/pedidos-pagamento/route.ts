import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { podeAcessarFinanceiro } from '@/lib/auth/financeiro-acesso'
import { normalizarPedido } from '@/lib/financeiro/pedidos-pagamento'

// GET — lista os pedidos de pagamento; POST — a Operação cadastra um pedido (fica "aguardando OK").
// Quem vê/cadastra: os sócios (Cristiano e Valéria) e o Célio. Mesmo escopo das políticas do banco.
async function checar() {
  const auth = await apiGuard(['socio', 'administrativo'])
  if (auth instanceof NextResponse) return { auth: null, resposta: auth }
  if (auth.role === 'administrativo' && !podeAcessarFinanceiro(auth.userId, auth.role)) {
    return { auth: null, resposta: NextResponse.json({ error: 'Sem permissão' }, { status: 403 }) }
  }
  return { auth, resposta: null }
}

export async function GET() {
  const { auth, resposta } = await checar()
  if (!auth) return resposta!
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos_pagamento')
    .select('*')
    .order('status', { ascending: true })
    .order('vencimento', { ascending: true })
    .limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const { auth, resposta } = await checar()
  if (!auth) return resposta!
  const body = await req.json().catch(() => null)
  const r = normalizarPedido(body)
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 })

  const supabase = await createClient()
  const { data: equipe } = await supabase.rpc('perfis_equipe')
  const nome = ((equipe ?? []) as { id: string; nome: string }[]).find(p => p.id === auth.userId)?.nome ?? null

  const { data, error } = await supabase
    .from('pedidos_pagamento')
    .insert({ ...r.dados, solicitado_por: auth.userId, solicitado_por_nome: nome })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
