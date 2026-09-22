import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createServiceClient } from '@/lib/supabase/service'
import { createSupabaseCobrancasStore } from '@/lib/cobrancas-store'
import { getInterChargePdf, extractPdfBase64, sanitizeInterError } from '@/lib/interClient'

const ALLOWED = ['socio'] as const

/** GET /api/financeiro/cobrancas/:id/pdf — baixa o boleto direto do Inter.
 *
 * O Inter não devolve uma URL de PDF na criação/consulta normal da
 * cobrança (só na criação/consulta interna do PDF, como base64) — por
 * isso essa rota dedicada, chamada só quando a usuária pede pra ver o
 * boleto, em vez de tentar (sem sucesso) extrair uma URL que nunca vem.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard([...ALLOWED])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = createServiceClient()
  const store = createSupabaseCobrancasStore(supabase)

  const cobranca = await store.findCobrancaById(id)
  if (!cobranca) return NextResponse.json({ error: 'Cobranca nao encontrada.' }, { status: 404 })
  if (!cobranca.inter_cobranca_id) {
    return NextResponse.json({ error: 'Cobranca ainda nao foi emitida no Inter.' }, { status: 409 })
  }

  try {
    const payload = await getInterChargePdf(cobranca.inter_cobranca_id)
    const base64 = extractPdfBase64(payload)
    if (!base64) {
      return NextResponse.json({ error: 'Inter nao retornou o PDF do boleto.' }, { status: 502 })
    }

    const bytes = Buffer.from(base64, 'base64')
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="boleto-${cobranca.id}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? sanitizeInterError(error.message) : 'Erro ao buscar o PDF no Inter.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
