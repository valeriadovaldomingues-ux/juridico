import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { portalDb } from '@/lib/portal-cliente/db'
import { definirMostrarHoras, encerrarSessoes, liberarAcesso, revogarAcesso } from '@/lib/portal-cliente/gestao'
import { enviarCodigoPorEmail } from '@/lib/portal-cliente/emails'
import { COOKIE_SESSAO, PORTAL_PAPEIS_GESTAO } from '@/lib/portal-cliente/constantes'
import { criarSessaoPrevia, opcoesCookie } from '@/lib/portal-cliente/sessao'
import { registrarLogPortal } from '@/lib/portal-cliente/log'
import { json, lerCorpoJson, tratarErro } from '@/lib/portal-cliente/http'
import { isUUID } from '@/lib/portal/validate'
import type { UserRole } from '@/types'

/**
 * POST /api/portal-admin/clientes/[id]
 *   { acao: 'liberar', email_acesso, enviar_codigo? }  — libera o cliente com o e-mail de acesso informado
 *   { acao: 'revogar' }                                — bloqueia o acesso e encerra todas as sessões
 *   { acao: 'encerrar_sessoes' }                       — só derruba as sessões abertas
 *   { acao: 'definir_horas', mostrar: boolean }        — liga/desliga a aba Horas no portal deste cliente
 *   { acao: 'ver_como_cliente' }                       — abre o portal como o cliente vê (30 min, só leitura), sem código
 * Só quem gerencia o portal (hoje: sócio). Tudo vai para portal_acessos_log.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(PORTAL_PAPEIS_GESTAO as UserRole[])
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!isUUID(id)) return json({ error: 'Cliente inválido.' }, 404)

  const lido = await lerCorpoJson(request)
  if ('erro' in lido) return lido.erro
  const { acao, email_acesso, enviar_codigo, mostrar } = lido.corpo

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
    if (acao === 'ver_como_cliente') {
      // Só para cliente com acesso LIBERADO (é a mesma regra de qualquer sessão do portal); nunca contorna uma revogação.
      const { data: acesso } = await db.from('portal_acessos').select('ativo').eq('cliente_id', id).maybeSingle()
      if (!acesso || acesso.ativo !== true) return json({ error: 'Libere o acesso deste cliente ao portal antes de visualizar.' }, 409)
      const { token, expiraEm } = await criarSessaoPrevia(db, id, auth.userId)
      await registrarLogPortal(db, { acao: 'previa_socio', clienteId: id, usuarioId: auth.userId })
      const resposta = json({ ok: true, url: '/portal', expiraEm: expiraEm.toISOString() })
      resposta.cookies.set(COOKIE_SESSAO, token, opcoesCookie(expiraEm))
      return resposta
    }
    if (acao === 'definir_horas') {
      if (typeof mostrar !== 'boolean') return json({ error: 'Informe se as horas devem aparecer.' }, 400)
      const r = await definirMostrarHoras(db, id, mostrar, auth.userId)
      if (!r.ok) return json({ error: r.erro }, r.status)
      return json({ ok: true, mostrarHoras: mostrar })
    }
    if (acao === 'revogar') return json({ ok: true, ...(await revogarAcesso(db, id, auth.userId)) })
    if (acao === 'encerrar_sessoes') return json({ ok: true, ...(await encerrarSessoes(db, id, auth.userId)) })
    return json({ error: 'Ação inválida.' }, 400)
  } catch (e) {
    return tratarErro(e, 'acesso-cliente')
  }
}
