import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { competenciaDe, competenciaAtual, computeTotais } from '@/lib/honorarios/service'
import { executarConsulta } from '@/lib/honorarios/consulta'
import type { HonorarioMensal } from '@/lib/honorarios/types'

// GET /api/financeiro/honorarios/consulta?q=...&competencia=YYYY-MM
// Consulta determinística (item 8): interpreta a pergunta e devolve o recorte + totais.
export async function GET(req: NextRequest) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const url = new URL(req.url)
  const q = url.searchParams.get('q') ?? ''
  const compParam = url.searchParams.get('competencia')
  const competencia = compParam ? competenciaDe(`${compParam}-01`.slice(0, 10)) : competenciaAtual()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('honorarios_mensais')
    .select('*, cliente:clientes(id, nome)')
    .eq('competencia', competencia)
    .eq('arquivado', false)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const registros = (data ?? []) as HonorarioMensal[]
  const resultado = executarConsulta(q, registros)

  return NextResponse.json({
    competencia,
    intencao: resultado.intencao,
    titulo: resultado.titulo,
    registros: resultado.registros,
    totais: computeTotais(resultado.registros),
    pdfUrl: `/api/financeiro/honorarios/relatorio-mensal/pdf?competencia=${competencia.slice(0, 7)}`,
  })
}
