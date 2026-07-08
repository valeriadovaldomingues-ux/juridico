import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { competenciaDe, competenciaAtual, montarRegistrosDoMes } from '@/lib/honorarios/service'
import type { HonorarioContrato, HonorarioMensal } from '@/lib/honorarios/types'

// POST /api/financeiro/honorarios/gerar-mes  { competencia?: 'YYYY-MM' }
// Bootstrap: cria os registros do mês a partir dos contratos ativos (idempotente).
export async function POST(req: NextRequest) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => ({}))
  const competencia = body.competencia
    ? competenciaDe(`${String(body.competencia)}-01`.slice(0, 10))
    : competenciaAtual()

  const supabase = await createClient()

  const [{ data: contratos, error: errC }, { data: existentes, error: errE }] = await Promise.all([
    supabase.from('honorarios_contratos').select('*').eq('status', 'ativo'),
    supabase.from('honorarios_mensais').select('*').eq('competencia', competencia),
  ])
  if (errC) return NextResponse.json({ error: errC.message }, { status: 500 })
  if (errE) return NextResponse.json({ error: errE.message }, { status: 500 })

  const novos = montarRegistrosDoMes(
    competencia,
    (contratos ?? []) as HonorarioContrato[],
    (existentes ?? []) as HonorarioMensal[],
  )

  if (!novos.length) {
    return NextResponse.json({ competencia, gerados: 0, mensagem: 'Nenhum registro novo a gerar.' })
  }

  const rows = novos.map(n => ({ ...n, criado_por: auth.userId, responsavel_lancamento_id: auth.userId }))
  const { data, error } = await supabase.from('honorarios_mensais').insert(rows).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ competencia, gerados: data?.length ?? 0 }, { status: 201 })
}
