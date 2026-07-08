import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { competenciaDe, competenciaAtual } from '@/lib/honorarios/service'
import { gerarRelatorioMensalPdf } from '@/lib/honorarios/pdf'
import type { HonorarioMensal } from '@/lib/honorarios/types'

export const runtime = 'nodejs'

// GET /api/financeiro/honorarios/relatorio-mensal/pdf?competencia=YYYY-MM
export async function GET(req: NextRequest) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const compParam = new URL(req.url).searchParams.get('competencia')
  const competencia = compParam ? competenciaDe(`${compParam}-01`.slice(0, 10)) : competenciaAtual()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('honorarios_mensais')
    .select('*, cliente:clientes(id, nome)')
    .eq('competencia', competencia)
    .eq('arquivado', false)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const bytes = await gerarRelatorioMensalPdf(competencia, (data ?? []) as HonorarioMensal[])

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="honorarios-${competencia.slice(0, 7)}.pdf"`,
      'cache-control': 'no-store',
    },
  })
}
