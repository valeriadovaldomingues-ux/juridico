import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { competenciaDe, montarParcelasExtra } from '@/lib/honorarios/service'
import { registrarLogHonorario } from '@/lib/honorarios/audit'
import type { HonorarioExtra } from '@/lib/honorarios/types'

const SELECT = '*, cliente:clientes(id, nome)'

// GET /api/financeiro/honorarios/extras
export async function GET() {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('honorarios_extras')
    .select(SELECT)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ extras: data ?? [] })
}

// POST /api/financeiro/honorarios/extras — cria honorário avulso + gera as parcelas
export async function POST(req: NextRequest) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  if (!body.cliente_id) return NextResponse.json({ error: 'cliente_id é obrigatório' }, { status: 400 })
  if (!body.descricao) return NextResponse.json({ error: 'descricao é obrigatória' }, { status: 400 })
  if (body.valor_total === undefined) return NextResponse.json({ error: 'valor_total é obrigatório' }, { status: 400 })

  const numParcelas = Math.min(Math.max(Number(body.num_parcelas) || 1, 1), 60)
  const primeira = competenciaDe(`${String(body.primeira_competencia ?? new Date().toISOString().slice(0, 7))}-01`.slice(0, 10))
  const dia = Number(body.dia_vencimento) || 10

  const supabase = await createClient()

  // 1. Cabeçalho.
  const { data: extra, error: errE } = await supabase
    .from('honorarios_extras')
    .insert({
      cliente_id:           body.cliente_id,
      descricao:            body.descricao,
      valor_total:          Number(body.valor_total) || 0,
      num_parcelas:         numParcelas,
      forma_pagamento:      body.forma_pagamento || null,
      primeira_competencia: primeira,
      observacoes:          body.observacoes || null,
      criado_por:           auth.userId,
    })
    .select(SELECT)
    .single()
  if (errE) return NextResponse.json({ error: errE.message }, { status: 400 })

  // 2. Parcelas → honorarios_mensais (tipo='extra').
  const parcelas = montarParcelasExtra(extra as HonorarioExtra, dia)
  const rows = parcelas.map(p => ({ ...p, criado_por: auth.userId, responsavel_lancamento_id: auth.userId }))
  const { data: inseridas, error: errP } = await supabase
    .from('honorarios_mensais')
    .insert(rows)
    .select('id')
  if (errP) return NextResponse.json({ error: errP.message }, { status: 400 })

  await registrarLogHonorario(supabase, {
    extra_id: (extra as HonorarioExtra).id,
    acao: 'criado',
    detalhes: { descricao: body.descricao, valor_total: Number(body.valor_total) || 0, parcelas: numParcelas },
  }, auth.userId)

  return NextResponse.json({ extra, parcelas: inseridas?.length ?? 0 }, { status: 201 })
}
