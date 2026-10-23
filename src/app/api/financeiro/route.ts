import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { podeGerenciarLancamentoDespesa } from '@/lib/auth/despesas-acesso'
import { createClient } from '@/lib/supabase/server'
import { fornecedorDaDescricao } from '@/lib/financeiro/fornecedor'
import { lerPagamento, serieDeParcelas } from '@/lib/financeiro/forma-pagamento'
import { lerRecorrencia, serieRecorrente } from '@/lib/financeiro/recorrencia'

export async function POST(req: NextRequest) {
  const auth = await apiGuard(['gerente', 'socio', 'administrativo'])
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()
  const body = await req.json()

  if (!podeGerenciarLancamentoDespesa(auth.userId, auth.role, body.tipo)) {
    return NextResponse.json({ error: 'Sem permissão para esta operação' }, { status: 403 })
  }

  // Forma de pagamento (só despesa). Crédito parcelado: lança a parcela informada e as seguintes, uma por mês.
  const pag = body.tipo === 'despesa'
    ? lerPagamento(body)
    : { ok: true as const, dados: { forma_pagamento: null, parcelas_total: null, parcela_atual: null } }
  if (!pag.ok) return NextResponse.json({ error: pag.erro }, { status: 400 })
  // Pagamento recorrente/parcelado (despesas e receitas extras): um lançamento por mês. Não vale junto com o parcelamento do crédito.
  const rec = lerRecorrencia(body.recorrencia)
  if (!rec.ok) return NextResponse.json({ error: rec.erro }, { status: 400 })
  if (rec.dados && pag.dados.forma_pagamento === 'credito' && pag.dados.parcelas_total) {
    return NextResponse.json({ error: 'No crédito parcelado use o total de parcelas do próprio crédito, sem a recorrência.' }, { status: 400 })
  }
  const valorBase = Number(body.valor)
  const serie = rec.dados
    ? serieRecorrente(body.vencimento, valorBase, rec.dados)
    : serieDeParcelas(body.vencimento, pag.dados, body.lancar_parcelas_seguintes !== false).map(p => ({ ...p, valor: valorBase, parcelas_total: pag.dados.parcelas_total }))
  const parcelamentoId = serie.length > 1 ? crypto.randomUUID() : null

  const linhas = serie.map((parcela, i) => ({
    tipo:         body.tipo,
    categoria:    body.categoria || 'Geral',
    descricao:    body.descricao,
    valor:        parcela.valor,
    vencimento:   parcela.vencimento,
    // as parcelas futuras nascem pendentes; só a primeira herda o status/pagamento informado
    pagamento_em: i === 0 ? (body.pagamento_em || null) : null,
    cliente_id:   body.cliente_id  || null,
    processo_id:  body.processo_id || null,
    status:       i === 0 ? body.status : 'pendente',
    centro_custo: body.centro_custo || null,
    fornecedor:   body.tipo === 'despesa' ? (String(body.fornecedor ?? '').trim() || fornecedorDaDescricao(String(body.descricao ?? '')) || null) : null,
    forma_pagamento: pag.dados.forma_pagamento,
    parcelas_total:  rec.dados ? parcela.parcelas_total : pag.dados.parcelas_total,
    parcela_atual:   rec.dados ? parcela.parcela_atual : (pag.dados.forma_pagamento === 'credito' && pag.dados.parcelas_total ? parcela.parcela_atual : null),
    parcelamento_id: parcelamentoId,
  }))

  const { data: criados, error } = await supabase
    .from('financeiro_lancamentos')
    .insert(linhas)
    .select('*, cliente:clientes(id, nome), processo:processos(id, numero_processo, titulo)')
    .order('vencimento', { ascending: true })

  if (error || !criados?.length) return NextResponse.json({ error: error?.message ?? 'Não foi possível salvar.' }, { status: 400 })
  const [data, ...parcelasExtras] = criados.map(c => ({ ...c }))
  return NextResponse.json({ ...data, parcelas_extras: parcelasExtras }, { status: 201 })
}
