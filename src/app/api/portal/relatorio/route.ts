import { NextResponse } from 'next/server'
import { portalGuard } from '@/lib/auth/portal-guard'
import { portalDb } from '@/lib/portal-cliente/db'
import { aplicarLimites, LIMITES } from '@/lib/portal-cliente/anti-abuso'
import { registrarLogPortal } from '@/lib/portal-cliente/log'
import { json, tratarErro } from '@/lib/portal-cliente/http'
import { gerarRelatorioDoClientePdf } from '@/lib/relatorio-sintetico/cliente'
import { hojeSP } from '@/lib/portal-cliente/consultas'

export const maxDuration = 60

/**
 * GET /api/portal/relatorio — PDF "Relatório sintético de processos" do cliente da sessão.
 * Versão cliente: só processos visíveis, sem financeiro, sem observações internas. Limite: 10 por hora por cliente.
 */
export async function GET() {
  const session = await portalGuard()
  if (session instanceof NextResponse) return session
  try {
    const db = portalDb()
    const limite = await aplicarLimites(db, [LIMITES.relatorioPorCliente(session.clienteId)])
    if (!limite.ok) return json({ error: 'Você já baixou o relatório várias vezes agora há pouco. Tente de novo mais tarde.' }, 429)

    const agora = new Date()
    const bytes = await gerarRelatorioDoClientePdf(db, session.clienteId, session.clienteNome, agora)
    if (!session.previa) await registrarLogPortal(db, { acao: 'download_relatorio', clienteId: session.clienteId })
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="meus-processos-${hojeSP(agora)}.pdf"`,
        'cache-control': 'no-store',
      },
    })
  } catch (e) {
    return tratarErro(e, 'relatorio')
  }
}
