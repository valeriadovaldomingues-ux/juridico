import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { portalDb } from '@/lib/portal-cliente/db'
import { decidirPedido } from '@/lib/portal-cliente/gestao'
import { enviarCodigoPorEmail } from '@/lib/portal-cliente/emails'
import { PORTAL_PAPEIS_GESTAO } from '@/lib/portal-cliente/constantes'
import { json, lerCorpoJson, tratarErro } from '@/lib/portal-cliente/http'
import { isUUID } from '@/lib/portal/validate'
import type { UserRole } from '@/types'

/**
 * POST /api/portal-admin/pedidos/[id]  { acao: 'aprovar' | 'rejeitar', cliente_id?, email_acesso?, confirmado_com_cliente? }
 *
 * Aprovar exige a confirmação de que o escritório falou com o cliente (telefone/WhatsApp), o cliente escolhido
 * precisa ter o documento do pedido, e o código inicial vai SOMENTE para o e-mail de acesso informado aqui pelo sócio.
 * Em qualquer decisão, nascimento / nome da mãe / nome do pai do pedido são apagados.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(PORTAL_PAPEIS_GESTAO as UserRole[])
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!isUUID(id)) return json({ error: 'Pedido inválido.' }, 404)

  const lido = await lerCorpoJson(request)
  if ('erro' in lido) return lido.erro
  const { acao, cliente_id, email_acesso, confirmado_com_cliente } = lido.corpo
  if (acao !== 'aprovar' && acao !== 'rejeitar') return json({ error: 'Ação inválida.' }, 400)
  if (cliente_id !== undefined && !isUUID(cliente_id)) return json({ error: 'Cliente inválido.' }, 400)

  try {
    const db = portalDb()
    const r = await decidirPedido(db, {
      pedidoId: id,
      usuarioId: auth.userId,
      acao,
      clienteId: typeof cliente_id === 'string' ? cliente_id : undefined,
      emailAcesso: typeof email_acesso === 'string' ? email_acesso : undefined,
      confirmadoComCliente: confirmado_com_cliente === true,
    })
    if (!r.ok) return json({ error: r.erro }, r.status)
    let codigoEnviado = false
    if (r.codigoParaEnviar) codigoEnviado = await enviarCodigoPorEmail(r.codigoParaEnviar.para, r.codigoParaEnviar.codigo)
    return json({ ok: true, codigoEnviado })
  } catch (e) {
    return tratarErro(e, 'decidir-pedido')
  }
}
