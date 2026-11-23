import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createServiceClient } from '@/lib/supabase/service'
import { COBRANCAS_SELECT } from '@/lib/cobrancas'
import { createSupabaseCobrancasStore } from '@/lib/cobrancas-store'
import { gerarCarneAction } from '@/lib/cobrancas-carne-action'
import { extractPdfBase64, getInterChargePdf, sanitizeInterError } from '@/lib/interClient'
import type { Cobranca } from '@/types/cobrancas'

const ALLOWED = ['socio'] as const
export const maxDuration = 60

/**
 * GET /api/financeiro/cobrancas/:id/carne — PDF único com todos os boletos do contrato desta cobrança
 * (resumo + parcelas em ordem). Só entrega o carnê completo; se faltar algo, responde 409 dizendo o quê.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard([...ALLOWED])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = createServiceClient()
  const store = createSupabaseCobrancasStore(supabase)

  const referencia = await store.findCobrancaById(id)
  if (!referencia) return NextResponse.json({ error: 'Cobrança não encontrada.' }, { status: 404 })

  let consulta = supabase
    .from('cobrancas')
    .select(COBRANCAS_SELECT)
    .eq('cliente_id', referencia.cliente_id)
    .eq('parcela_total', referencia.parcela_total)
    .neq('status', 'cancelada')
    .limit(500)
  consulta = referencia.processo_id ? consulta.eq('processo_id', referencia.processo_id) : consulta.is('processo_id', null)
  const { data, error } = await consulta
  if (error) return NextResponse.json({ error: 'Não consegui consultar as parcelas do contrato.' }, { status: 500 })

  const resultado = await gerarCarneAction({
    role: auth.role,
    userId: auth.userId,
    referencia,
    candidatas: (data ?? []) as unknown as Cobranca[],
    buscarPdf: async interId => {
      try {
        const payload = await getInterChargePdf(interId)
        const base64 = extractPdfBase64(payload)
        return base64 ? new Uint8Array(Buffer.from(base64, 'base64')) : null
      } catch (e) {
        // Repassa a mensagem (sem segredos) para a regra de nova tentativa em 429.
        throw new Error(e instanceof Error ? sanitizeInterError(e.message) : 'Erro ao buscar o PDF no Inter.')
      }
    },
    esperar: ms => new Promise(resolve => setTimeout(resolve, ms)),
    registrar: async ({ parcelas }) => {
      await store.insertLog({ cobranca_id: referencia.id, acao: 'carne_gerado', detalhe: `${parcelas} parcelas`, usuario_id: auth.userId })
    },
  })

  if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status })
  return new NextResponse(Buffer.from(resultado.pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${resultado.nomeArquivo}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
