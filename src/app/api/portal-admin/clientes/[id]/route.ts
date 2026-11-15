import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { portalDb } from '@/lib/portal-cliente/db'
import { encerrarSessoes, liberarAcesso, revogarAcesso } from '@/lib/portal-cliente/gestao'
import { enviarCodigoPorEmail } from '@/lib/portal-cliente/emails'
import { PORTAL_PAPEIS_GESTAO } from '@/lib/portal-cliente/constantes'
import { json, lerCorpoJson, tratarErro } from '@/lib/portal-cliente/http'
import { isUUID } from '@/lib/portal/validate'
import type { UserRole } from '@/types'

/**
 * POST /api/portal-admin/clientes/[id]
 *   { acao: 'liberar', email_acesso, enviar_codigo? }  — libera o cliente com o e-mail de acesso informado
 *   { acao: 'revogar' }                                — bloqueia o acesso e encerra todas as sessões
 *   { acao: 'encerrar_sessoes' }                       — só derruba as sessões abertas
 * Só quem gerencia o portal (hoje: sócio). Tudo vai para portal_acessos_log.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(PORTAL_PAPEIS_GESTAO as UserRole[])
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!isUUID(id)) return json({ error: 'Cliente inválido.' }, 404)

  const lido = await lerCorpoJson(request)
  if ('erro' in lido) return lido.erro
  const { acao, email_acesso, enviar_codigo } = lido.corpo

  try {
    const db = portalDb()
    if (acao === 'liberar') {
      if (typeof email_acesso !== 'string') return json({ error: 'Informe o e-mail de acesso.' }, 400)
      const r = await liberarAcesso(db, { clienteId: id, emailAcesso: email_acesso, usuarioId: auth.userId, enviarCodigo: enviar_codigo === true })
      if (!r.ok) return json({ error: r.erro }, r.status)
      let codigoEnviado = false
      if (r.codigoParaEnviar) codigoEnviado = await enviarCodigoPorEmail(r.codigoParaEnviar.para, r.codigoParaEnviar.codigo)
      return json({ ok: true, codigoEnviado })
    }
    if (acao === 'revogar') return json({ ok: true, ...(await revogarAcesso(db, id, auth.userId)) })
    if (acao === 'encerrar_sessoes') return json({ ok: true, ...(await encerrarSessoes(db, id, auth.userId)) })
    return json({ error: 'Ação inválida.' }, 400)
  } catch (e) {
    return tratarErro(e, 'acesso-cliente')
  }
}
