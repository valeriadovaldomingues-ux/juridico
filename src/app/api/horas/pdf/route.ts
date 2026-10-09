import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { isUUID } from '@/lib/portal/validate'
import { buscarHoras, dataValida } from '@/lib/relatorio-horas/dados'
import { gerarRelatorioHorasPdf } from '@/lib/relatorio-horas/pdf'

const ROLES = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'] as const

function slug(v: string) {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'cliente'
}

export async function GET(req: NextRequest) {
  const auth = await apiGuard([...ROLES])
  if (auth instanceof NextResponse) return auth

  const p = req.nextUrl.searchParams
  const clienteId = p.get('cliente_id')
  const de = p.get('de')
  const ate = p.get('ate')
  if (!clienteId || !isUUID(clienteId)) return NextResponse.json({ error: 'Escolha o cliente.' }, { status: 400 })
  if (!dataValida(de) || !dataValida(ate)) return NextResponse.json({ error: 'Período inválido.' }, { status: 400 })

  const supabase = await createClient()
  const relatorio = await buscarHoras(supabase, { clienteId, de, ate })
  const bytes = await gerarRelatorioHorasPdf(relatorio)

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="horas-${slug(relatorio.cliente)}-${de}-a-${ate}.pdf"`,
      'cache-control': 'no-store',
    },
  })
}
