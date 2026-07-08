import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { competenciaDe, competenciaAtual, dataVencimento } from '@/lib/honorarios/service'
import { registrarLogHonorario } from '@/lib/honorarios/audit'

const SELECT = '*, cliente:clientes(id, nome), responsavel:profiles!responsavel_lancamento_id(id, nome)'

// GET /api/financeiro/honorarios?competencia=YYYY-MM
//   filtros: &cliente_id= &status= &responsavel= &somentePendentes=1 &incluirArquivados=1
export async function GET(req: NextRequest) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const url = new URL(req.url)
  const compParam = url.searchParams.get('competencia')
  const competencia = compParam ? competenciaDe(`${compParam}-01`.slice(0, 10)) : competenciaAtual()
  const incluirArquivados = url.searchParams.get('incluirArquivados') === '1'
  const clienteFiltro = url.searchParams.get('cliente_id')
  const statusFiltro = url.searchParams.get('status')
  const responsavelFiltro = url.searchParams.get('responsavel')
  const somentePendentes = url.searchParams.get('somentePendentes') === '1'

  const supabase = await createClient()
  let query = supabase
    .from('honorarios_mensais')
    .select(SELECT)
    .eq('competencia', competencia)
    .order('status', { ascending: true })

  if (!incluirArquivados) query = query.eq('arquivado', false)
  if (clienteFiltro) query = query.eq('cliente_id', clienteFiltro)
  if (statusFiltro) query = query.eq('status', statusFiltro)
  if (responsavelFiltro) query = query.eq('responsavel_lancamento_id', responsavelFiltro)
  if (somentePendentes) query = query.gt('saldo_pendente', 0)

  const [{ data, error }, { data: fechamento }] = await Promise.all([
    query,
    supabase.from('honorarios_fechamentos').select('competencia').eq('competencia', competencia).maybeSingle(),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ competencia, registros: data ?? [], fechado: !!fechamento })
}

// POST /api/financeiro/honorarios — cria um registro manual avulso
export async function POST(req: NextRequest) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  if (!body.cliente_id) return NextResponse.json({ error: 'cliente_id é obrigatório' }, { status: 400 })
  if (!body.competencia) return NextResponse.json({ error: 'competencia é obrigatória' }, { status: 400 })

  const competencia = competenciaDe(`${String(body.competencia)}-01`.slice(0, 10))
  const dia = Number(body.dia_vencimento) || 10

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('honorarios_mensais')
    .insert({
      competencia,
      cliente_id:      body.cliente_id,
      contrato_id:     body.contrato_id ?? null,
      valor_devido:    Number(body.valor_devido) || 0,
      saldo_anterior:  Number(body.saldo_anterior) || 0,
      valor_pago:      Number(body.valor_pago) || 0,
      vencimento:      body.vencimento || dataVencimento(competencia, dia),
      status:          body.status || 'pendente',
      forma_pagamento: body.forma_pagamento || null,
      observacoes:     body.observacoes || null,
      responsavel_lancamento_id: auth.userId,
      criado_por:      auth.userId,
    })
    .select(SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrarLogHonorario(supabase, {
    registro_id: data.id as string,
    acao: 'criado',
    detalhes: { manual: true, competencia },
  }, auth.userId)

  return NextResponse.json(data, { status: 201 })
}
