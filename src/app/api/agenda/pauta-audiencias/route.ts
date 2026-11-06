import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { dataValida } from '@/lib/relatorio-horas/dados'
import { buscarPauta, gerarPautaPdf } from '@/lib/agenda/pauta'

const ROLES = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'] as const
const MAX_DIAS = 93

// GET /api/agenda/pauta-audiencias?de=AAAA-MM-DD&ate=AAAA-MM-DD — PDF da pauta de audiências do período.
export async function GET(req: NextRequest) {
  const auth = await apiGuard([...ROLES])
  if (auth instanceof NextResponse) return auth

  const p = req.nextUrl.searchParams
  const de = p.get('de')
  const ate = p.get('ate')
  if (!dataValida(de) || !dataValida(ate)) return NextResponse.json({ error: 'Período inválido.' }, { status: 400 })
  if (ate < de) return NextResponse.json({ error: 'A data final é anterior à inicial.' }, { status: 400 })
  if ((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86400_000 > MAX_DIAS) {
    return NextResponse.json({ error: `Escolha um período de até ${MAX_DIAS} dias.` }, { status: 400 })
  }

  try {
    const itens = await buscarPauta(await createClient(), de, ate)
    const bytes = await gerarPautaPdf(itens, de, ate)
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="pauta-audiencias-${de}-a-${ate}.pdf"`,
        'cache-control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Não foi possível gerar a pauta agora.' }, { status: 500 })
  }
}
