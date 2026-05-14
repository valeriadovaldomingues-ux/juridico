import { NextRequest, NextResponse } from 'next/server'
import { portalGuard } from '@/lib/auth/portal-guard'
import { logPortalAccess, type PortalAcao } from '@/lib/portal/access-log'

const ACOES_VALIDAS: PortalAcao[] = [
  'login', 'view_processo', 'view_agenda', 'view_documento',
  'download_documento', 'send_message', 'view_mensagens', 'view_perfil',
]

/**
 * POST /api/portal/access-log
 * Permite que o frontend do portal registre ações client-side
 * (ex: visualização de página que não passa por API).
 *
 * Body: { acao, resource_id? }
 */
export async function POST(request: NextRequest) {
  const session = await portalGuard()
  if (session instanceof NextResponse) return session

  let body: { acao?: string; resource_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const acao = body.acao as PortalAcao

  if (!acao || !ACOES_VALIDAS.includes(acao)) {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  }

  await logPortalAccess({
    userId:     session.userId,
    clienteId:  session.clienteId,
    acao,
    resourceId: body.resource_id,
    request,
  })

  return new NextResponse(null, { status: 204 })
}
