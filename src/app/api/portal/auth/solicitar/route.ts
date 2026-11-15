/**
 * POST /api/portal/auth/solicitar  { documento }
 *
 * Pede o código de acesso. A resposta é SEMPRE a mesma (e leva ~800 ms), exista ou não o documento, tenha ou não
 * liberação. Só recebe código quem tem liberação ATIVA em portal_acessos (modo piloto), e o código vai somente para
 * o e-mail de acesso que o escritório liberou — nunca para e-mail digitado aqui (a rota nem lê e-mail do corpo).
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkOrigin } from '@/lib/portal/origin'
import { extractIP } from '@/lib/portal/validate'
import { normalizarDocumento } from '@/lib/portal-cliente/documento'
import { portalDb } from '@/lib/portal-cliente/db'
import { aplicarLimites, LIMITES, limpezaOportunista } from '@/lib/portal-cliente/anti-abuso'
import { prepararCodigo } from '@/lib/portal-cliente/login'
import { enviarCodigoPorEmail } from '@/lib/portal-cliente/emails'
import { emSegundoPlano } from '@/lib/portal-cliente/segundo-plano'
import { normalizarTempo } from '@/lib/portal-cliente/tempo'
import { json, lerCorpoJson, portalIndisponivel } from '@/lib/portal-cliente/http'
import { PortalIndisponivel } from '@/lib/portal-cliente/segredos'
import { TEMPO_MINIMO_LOGIN_MS } from '@/lib/portal-cliente/constantes'

const MENSAGEM_GENERICA =
  'Se este CPF ou CNPJ estiver liberado para o portal, enviamos um código de 6 dígitos para o e-mail de acesso cadastrado no escritório. Ele vale por 10 minutos.'

async function tratar(request: NextRequest): Promise<NextResponse> {
  const lido = await lerCorpoJson(request)
  if ('erro' in lido) return lido.erro

  const doc = normalizarDocumento(lido.corpo.documento)
  if (!doc.ok) return json({ error: 'Confira o CPF ou CNPJ digitado.' }, 400)

  try {
    const db = portalDb()
    const limite = await aplicarLimites(db, [LIMITES.solicitarPorDocumento(doc.digitos), LIMITES.solicitarPorIp(extractIP(request))])
    if (!limite.ok) return json({ error: 'Muitas tentativas. Aguarde um pouco e tente de novo.' }, 429)

    // Qualquer falha daqui para a frente responde igual (a falha só aconteceria para documentos existentes).
    try {
      const preparado = await prepararCodigo(db, doc.digitos)
      if (preparado) emSegundoPlano(async () => { await enviarCodigoPorEmail(preparado.para, preparado.codigo) })
      await limpezaOportunista(db)
    } catch (e) {
      if (e instanceof PortalIndisponivel) throw e
      console.error('[portal] erro ao preparar código')
    }
    return json({ ok: true, mensagem: MENSAGEM_GENERICA })
  } catch (e) {
    if (e instanceof PortalIndisponivel) return portalIndisponivel()
    console.error('[portal] erro em auth/solicitar')
    return json({ ok: true, mensagem: MENSAGEM_GENERICA })
  }
}

export async function POST(request: NextRequest) {
  const inicio = Date.now()
  const bloqueado = checkOrigin(request)
  if (bloqueado) return bloqueado
  const resposta = await tratar(request)
  await normalizarTempo(inicio, TEMPO_MINIMO_LOGIN_MS)
  return resposta
}
