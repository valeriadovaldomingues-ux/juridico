import { NextRequest, NextResponse } from 'next/server'
import { portalGuard }    from '@/lib/auth/portal-guard'
import { logPortalAccess, type PortalAcao } from '@/lib/portal/access-log'
import { checkOrigin }    from '@/lib/portal/origin'
import { checkContentLength, isUUID } from '@/lib/portal/validate'
import { accessLogByUser, checkRateLimit } from '@/lib/portal/rate-limit'

const ACOES_VALIDAS: PortalAcao[] = [
  'login', 'view_processo', 'view_agenda', 'view_documento',
  'download_documento', 'send_message', 'view_mensagens', 'view_perfil',
]

/**
 * POST /api/portal/access-log
 * Registra ações client-side que não passam por outras API Routes.
 * Body: { acao: PortalAcao, resource_id?: UUID }
 */
export async function POST(request: NextRequest) {
  // ── CSRF ──────────────────────────────────────────────────────────────────
  const originBlocked = checkOrigin(request)
  if (originBlocked) return originBlocked

  // ── Tamanho do payload ────────────────────────────────────────────────────
  const sizeError = checkContentLength(request, 1024) // log payload <= 1KB
  if (sizeError) return NextResponse.json({ error: sizeError }, { status: 413 })

  // ── Autenticação ──────────────────────────────────────────────────────────
  const session = await portalGuard()
  if (session instanceof NextResponse) return session

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const rl = await checkRateLimit(accessLogByUser, session.userId)
  if (!rl.allowed) {
    // Bloqueio silencioso — log events não devem interromper a UX
    return new NextResponse(null, { status: 204 })
  }

  // ── Parse ─────────────────────────────────────────────────────────────────
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

  // UUID validado antes de passar para o logger
  const resourceId = body.resource_id && isUUID(body.resource_id)
    ? body.resource_id
    : undefined

  await logPortalAccess({
    userId:     session.userId,
    clienteId:  session.clienteId,
    acao,
    resourceId,
    request,
  })

  return new NextResponse(null, { status: 204 })
}
