import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { isUUID } from '@/lib/portal/validate'
import { listarPessoasComProcessos, montarRelatorioSintetico } from '@/lib/relatorio-sintetico/dados'
import { gerarRelatorioSinteticoPdf } from '@/lib/relatorio-sintetico/pdf'

const ROLES = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'] as const
export const maxDuration = 60

function slug(v: string) {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'pessoa'
}

// GET /api/relatorios/sintetico                 → pessoas que têm processos ligados (para a tela)
// GET /api/relatorios/sintetico?pessoa_id=<id>  → PDF "Relatório sintético de processos" em nome da pessoa
export async function GET(req: NextRequest) {
  const auth = await apiGuard([...ROLES])
  if (auth instanceof NextResponse) return auth
  const supabase = await createClient()

  const pessoaId = req.nextUrl.searchParams.get('pessoa_id')
  if (!pessoaId) return NextResponse.json({ pessoas: await listarPessoasComProcessos(supabase) })
  if (!isUUID(pessoaId)) return NextResponse.json({ error: 'Pessoa inválida.' }, { status: 400 })

  const relatorio = await montarRelatorioSintetico(supabase, pessoaId)
  if (!relatorio) return NextResponse.json({ error: 'Pessoa não encontrada.' }, { status: 404 })
  const bytes = await gerarRelatorioSinteticoPdf(relatorio)
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(relatorio.emitidoEm)
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="relatorio-sintetico-${slug(relatorio.pessoa)}-${dia}.pdf"`,
      'cache-control': 'no-store',
    },
  })
}
