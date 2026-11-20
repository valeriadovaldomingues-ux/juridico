import { NextRequest, NextResponse } from 'next/server'
import { portalGuard } from '@/lib/auth/portal-guard'
import { portalDb } from '@/lib/portal-cliente/db'
import { aplicarLimites, LIMITES } from '@/lib/portal-cliente/anti-abuso'
import { registrarLogPortal } from '@/lib/portal-cliente/log'
import { json, tratarErro } from '@/lib/portal-cliente/http'
import { hojeSP } from '@/lib/portal-cliente/consultas'
import { horasDoPeriodo, listarHoras, relatorioHorasDoCliente } from '@/lib/portal-cliente/horas'
import { gerarRelatorioHorasPdf } from '@/lib/relatorio-horas/pdf'

export const maxDuration = 60

/**
 * GET /api/portal/relatorio-horas?mes=AAAA-MM (ou sem mes = todo o período) — o mesmo PDF de horas que a equipe emite,
 * só do cliente da sessão e só com tempo (sem valores). Limite: 10 por hora por cliente (junto com o relatório de processos).
 */
export async function GET(req: NextRequest) {
  const session = await portalGuard()
  if (session instanceof NextResponse) return session
  try {
    const db = portalDb()
    const limite = await aplicarLimites(db, [LIMITES.relatorioPorCliente(session.clienteId)])
    if (!limite.ok) return json({ error: 'Você já baixou o relatório várias vezes agora há pouco. Tente de novo mais tarde.' }, 429)

    const mes = req.nextUrl.searchParams.get('mes')
    const { horas, de, ate } = horasDoPeriodo(await listarHoras(db, session.clienteId), mes)
    const bytes = await gerarRelatorioHorasPdf(relatorioHorasDoCliente(session.clienteNome, horas, { de, ate }))
    if (!session.previa) await registrarLogPortal(db, { acao: 'download_relatorio', clienteId: session.clienteId })
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="minhas-horas-${/^\d{4}-\d{2}$/.test(mes ?? '') ? mes : 'todo-o-periodo'}-${hojeSP()}.pdf"`,
        'cache-control': 'no-store',
      },
    })
  } catch (e) {
    return tratarErro(e, 'relatorio-horas')
  }
}
