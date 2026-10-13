import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { isUUID } from '@/lib/portal/validate'
import { descricaoDaDespesa } from '@/lib/financeiro/pedidos-pagamento'
import { serieDeParcelas } from '@/lib/financeiro/forma-pagamento'

// POST { acao: 'aprovar' | 'recusar', motivo? } — só o sócio decide.
// No OK, o pedido vira DESPESA na mesma hora (financeiro_lancamentos, status "pendente" = a pagar),
// com o nome de quem aprovou e quando. Recusar não cria nada.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!isUUID(id)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const acao = body?.acao === 'aprovar' ? 'aprovar' : body?.acao === 'recusar' ? 'recusar' : null
  if (!acao) return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  const motivo = String(body?.motivo ?? '').trim().slice(0, 400) || null

  const supabase = await createClient()
  const { data: equipe } = await supabase.rpc('perfis_equipe')
  const nome = ((equipe ?? []) as { id: string; nome: string }[]).find(p => p.id === auth.userId)?.nome ?? null
  const agora = new Date().toISOString()

  // "Pega" a decisão primeiro: só quem achar o pedido ainda aguardando consegue decidir (evita OK duplicado).
  const { data: pedido, error: errDecisao } = await supabase
    .from('pedidos_pagamento')
    .update({
      status: acao === 'aprovar' ? 'aprovado' : 'recusado',
      decidido_por: auth.userId, decidido_por_nome: nome, decidido_em: agora,
      motivo_recusa: acao === 'recusar' ? motivo : null,
    })
    .eq('id', id).eq('status', 'aguardando_ok')
    .select('*')
    .maybeSingle()
  if (errDecisao) return NextResponse.json({ error: errDecisao.message }, { status: 500 })
  if (!pedido) return NextResponse.json({ error: 'Este pedido já foi decidido ou não existe.' }, { status: 409 })

  if (acao === 'recusar') return NextResponse.json(pedido)

  // Crédito parcelado: o OK já lança todas as parcelas, uma em cada mês. Senão, uma despesa só.
  const serie = serieDeParcelas(
    pedido.vencimento,
    { forma_pagamento: pedido.forma_pagamento, parcelas_total: pedido.parcelas_total, parcela_atual: pedido.parcela_atual },
    true,
  )
  const parcelamentoId = serie.length > 1 ? crypto.randomUUID() : null
  const { data: lancamentos, error: errLanc } = await supabase
    .from('financeiro_lancamentos')
    .insert(serie.map(parcela => ({
      tipo: 'despesa',
      categoria: pedido.categoria || 'Geral',
      descricao: descricaoDaDespesa(pedido),
      valor: Number(pedido.valor),
      vencimento: parcela.vencimento,
      status: 'pendente',
      centro_custo: pedido.centro_custo,
      forma_pagamento: pedido.forma_pagamento,
      parcelas_total: pedido.parcelas_total,
      parcela_atual: pedido.forma_pagamento === 'credito' && pedido.parcelas_total ? parcela.parcela_atual : null,
      parcelamento_id: parcelamentoId,
    })))
    .select('id')
    .order('vencimento', { ascending: true })

  if (errLanc || !lancamentos?.length) {
    // Desfaz a decisão para o pedido não ficar "aprovado" sem despesa.
    await supabase.from('pedidos_pagamento')
      .update({ status: 'aguardando_ok', decidido_por: null, decidido_por_nome: null, decidido_em: null, motivo_recusa: null })
      .eq('id', id)
    return NextResponse.json({ error: `Não foi possível lançar a despesa: ${errLanc?.message ?? 'erro'}. O pedido continua aguardando o OK.` }, { status: 500 })
  }
  const lancamento = lancamentos[0]

  const { data: final } = await supabase
    .from('pedidos_pagamento').update({ lancamento_id: lancamento.id }).eq('id', id).select('*').single()
  return NextResponse.json(final ?? { ...pedido, lancamento_id: lancamento.id })
}
