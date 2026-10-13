import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { podeGerenciarLancamentoDespesa } from '@/lib/auth/despesas-acesso'
import { createClient } from '@/lib/supabase/server'
import { fornecedorDaDescricao } from '@/lib/financeiro/fornecedor'
import { lerPagamento } from '@/lib/financeiro/forma-pagamento'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard(['gerente', 'socio', 'administrativo'])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID ausente' }, { status: 400 })

  const supabase = await createClient()
  const body = await req.json()

  if (auth.role === 'administrativo') {
    const { data: atual } = await supabase
      .from('financeiro_lancamentos')
      .select('tipo')
      .eq('id', id)
      .maybeSingle()

    if (!atual || !podeGerenciarLancamentoDespesa(auth.userId, auth.role, atual.tipo)
      || !podeGerenciarLancamentoDespesa(auth.userId, auth.role, body.tipo)) {
      return NextResponse.json({ error: 'Sem permissão para esta operação' }, { status: 403 })
    }
  }

  const pag = body.tipo === 'despesa'
    ? lerPagamento(body)
    : { ok: true as const, dados: { forma_pagamento: null, parcelas_total: null, parcela_atual: null } }
  if (!pag.ok) return NextResponse.json({ error: pag.erro }, { status: 400 })

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
      fornecedor:   body.tipo === 'despesa' ? (String(body.fornecedor ?? '').trim() || fornecedorDaDescricao(String(body.descricao ?? '')) || null) : null,
      forma_pagamento: pag.dados.forma_pagamento,
      parcelas_total:  pag.dados.parcelas_total,
      parcela_atual:   pag.dados.parcela_atual,
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
