import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import {
  competenciaDe,
  competenciaAtual,
  competenciaSeguinte,
  computeTotais,
  montarRegistrosProximoMes,
} from '@/lib/honorarios/service'
import { registrarLogHonorario } from '@/lib/honorarios/audit'
import type { HonorarioContrato, HonorarioMensal } from '@/lib/honorarios/types'

// POST /api/financeiro/honorarios/fechar-mes  { competencia?, observacoes? }
// Consolida o mês, marca atrasos, gera as pendências do mês seguinte (carry-over).
export async function POST(req: NextRequest) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => ({}))
  const competencia = body.competencia
    ? competenciaDe(`${String(body.competencia)}-01`.slice(0, 10))
    : competenciaAtual()
  const hoje = new Date().toISOString().slice(0, 10)

  const supabase = await createClient()

  // 1. Já fechado?
  const { data: jaFechado } = await supabase
    .from('honorarios_fechamentos').select('id').eq('competencia', competencia).maybeSingle()
  if (jaFechado) {
    return NextResponse.json({ error: 'Esta competência já foi fechada.' }, { status: 409 })
  }

  // 2. Marca em atraso: pendentes vencidos sem pagamento.
  await supabase
    .from('honorarios_mensais')
    .update({ status: 'em_atraso' })
    .eq('competencia', competencia)
    .eq('status', 'pendente')
    .eq('valor_pago', 0)
    .lt('vencimento', hoje)

  // 3. Recarrega registros consolidados do mês.
  const { data: registros, error: errR } = await supabase
    .from('honorarios_mensais').select('*').eq('competencia', competencia)
  if (errR) return NextResponse.json({ error: errR.message }, { status: 500 })
  const registrosMes = (registros ?? []) as HonorarioMensal[]

  // 4. Snapshot de totais.
  const t = computeTotais(registrosMes)
  const { error: errF } = await supabase.from('honorarios_fechamentos').insert({
    competencia,
    fechado_por: auth.userId,
    total_previsto: t.previsto,
    total_recebido: t.recebido,
    total_pendente: t.pendente,
    observacoes: body.observacoes || null,
  })
  if (errF) return NextResponse.json({ error: errF.message }, { status: 400 })

  await registrarLogHonorario(supabase, {
    acao: 'fechamento',
    detalhes: { competencia, total_previsto: t.previsto, total_recebido: t.recebido, total_pendente: t.pendente },
  }, auth.userId)

  // 5. Gera o mês seguinte com carry-over do saldo.
  const proxima = competenciaSeguinte(competencia)
  const [{ data: contratos }, { data: proximoExistente }] = await Promise.all([
    supabase.from('honorarios_contratos').select('*').eq('status', 'ativo'),
    supabase.from('honorarios_mensais').select('*').eq('competencia', proxima),
  ])

  const novos = montarRegistrosProximoMes(
    competencia,
    (contratos ?? []) as HonorarioContrato[],
    registrosMes,
    (proximoExistente ?? []) as HonorarioMensal[],
  )

  let gerados = 0
  if (novos.length) {
    const rows = novos.map(n => ({ ...n, criado_por: auth.userId, responsavel_lancamento_id: auth.userId }))
    const { data, error } = await supabase.from('honorarios_mensais').insert(rows).select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    gerados = data?.length ?? 0
  }

  return NextResponse.json({
    competencia,
    fechada: true,
    totais: t,
    proxima_competencia: proxima,
    gerados,
  })
}
