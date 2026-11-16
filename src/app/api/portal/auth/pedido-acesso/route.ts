/**
 * POST /api/portal/auth/pedido-acesso  { documento, nascimento, nome_mae, nome_pai?, email, telefone? }
 *
 * Primeiro acesso: só cria um pedido PENDENTE na fila dos sócios. NÃO envia código a nenhum e-mail (muito menos ao
 * digitado aqui). Os dados de conferência servem de filtro para o humano e são apagados quando ele decide.
 * A resposta é sempre a mesma, exista ou não o documento no cadastro.
 */

import { NextRequest } from 'next/server'
import { checkOrigin } from '@/lib/portal/origin'
import { extractIP } from '@/lib/portal/validate'
import { documentoParcial } from '@/lib/portal-cliente/documento'
import { portalDb } from '@/lib/portal-cliente/db'
import { aplicarLimites, LIMITES } from '@/lib/portal-cliente/anti-abuso'
import { criarPedido, houvePedidoRecente, validarPedido } from '@/lib/portal-cliente/pedidos'
import { avisarSociosDoPedido } from '@/lib/portal-cliente/emails'
import { registrarLogPortal } from '@/lib/portal-cliente/log'
import { resumirIp, PortalIndisponivel } from '@/lib/portal-cliente/segredos'
import { emSegundoPlano } from '@/lib/portal-cliente/segundo-plano'
import { json, lerCorpoJson, portalIndisponivel } from '@/lib/portal-cliente/http'
import { notificarRoles } from '@/lib/notificacoes'
import { PORTAL_PAPEIS_GESTAO } from '@/lib/portal-cliente/constantes'
import type { UserRole } from '@/types'

const MENSAGEM = 'Recebemos o seu pedido. O escritório vai conferir os dados e entrar em contato com você.'

export async function POST(request: NextRequest) {
  const bloqueado = checkOrigin(request)
  if (bloqueado) return bloqueado

  const lido = await lerCorpoJson(request)
  if ('erro' in lido) return lido.erro

  // Isca para robôs: campo escondido que pessoas não preenchem.
  if (typeof lido.corpo.website === 'string' && lido.corpo.website.trim()) return json({ ok: true, mensagem: MENSAGEM })

  const v = validarPedido(lido.corpo)
  if (!v.ok) return json({ error: v.erro }, 400)

  try {
    const db = portalDb()
    const ip = extractIP(request)
    const limite = await aplicarLimites(db, [
      LIMITES.pedidoPorIp(ip), LIMITES.pedidoPorDocumento(v.dados.documento), LIMITES.pedidoPorEmail(v.dados.email), LIMITES.pedidoGlobal(),
    ])
    if (!limite.ok) return json({ error: 'Muitas tentativas. Aguarde um pouco e tente de novo.' }, 429)

    const { criado, id } = await criarPedido(db, v.dados, resumirIp(ip))
    if (criado) {
      await registrarLogPortal(db, { acao: 'pedido_criado', pedidoId: id })
      const parcial = documentoParcial(v.dados.documento)
      emSegundoPlano(async () => {
        if (await houvePedidoRecente(db, id)) return
        await avisarSociosDoPedido(db, parcial)
        await notificarRoles(PORTAL_PAPEIS_GESTAO as UserRole[], {
          title: 'Portal do Cliente: novo pedido de acesso',
          message: 'Chegou um pedido de primeiro acesso. Confirme com o cliente por telefone antes de aprovar.',
          type: 'info',
          link: '/clientes/acesso-portal',
        })
      })
    }
    return json({ ok: true, mensagem: MENSAGEM })
  } catch (e) {
    if (e instanceof PortalIndisponivel) return portalIndisponivel()
    console.error('[portal] erro em auth/pedido-acesso')
    return json({ error: 'Não foi possível registrar agora. Tente novamente em instantes.' }, 500)
  }
}
