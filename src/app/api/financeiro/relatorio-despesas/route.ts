import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { podeAcessarFinanceiro } from '@/lib/auth/financeiro-acesso'
import { createClient } from '@/lib/supabase/server'

// GET ?ano=2026 — todas as despesas que caem no ano (pela data do pagamento, ou vencimento se ainda não pago).
// Quem vê: sócios e o Célio (mesmo escopo da aba Despesas). A montagem do relatório é feita na tela.
export async function GET(req: NextRequest) {
  const auth = await apiGuard(['socio', 'administrativo'])
  if (auth instanceof NextResponse) return auth
  if (!podeAcessarFinanceiro(auth.userId, auth.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const anoParam = Number(req.nextUrl.searchParams.get('ano'))
  const ano = Number.isInteger(anoParam) && anoParam > 2000 && anoParam < 2100 ? anoParam : new Date().getFullYear()

  const supabase = await createClient()
  const campos = 'id, descricao, categoria, conta_contabil, valor, vencimento, pagamento_em, status, fornecedor, forma_pagamento, parcelas_total, parcela_atual'
  const { data, error } = await supabase
    .from('financeiro_lancamentos')
    .select(campos)
    .eq('tipo', 'despesa')
    .neq('status', 'cancelado')
    .or(`and(pagamento_em.gte.${ano}-01-01,pagamento_em.lte.${ano}-12-31),and(pagamento_em.is.null,vencimento.gte.${ano}-01-01,vencimento.lte.${ano}-12-31)`)
    .order('vencimento', { ascending: true })
    .limit(5000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Anos disponíveis para o seletor
  const { data: datas } = await supabase
    .from('financeiro_lancamentos')
    .select('vencimento, pagamento_em')
    .eq('tipo', 'despesa')
    .neq('status', 'cancelado')
    .limit(5000)

  return NextResponse.json({ ano, lancamentos: data ?? [], datas: datas ?? [] })
}
