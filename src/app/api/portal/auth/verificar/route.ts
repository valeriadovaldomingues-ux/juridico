/**
 * POST /api/portal/auth/verificar  { documento, codigo }
 *
 * Confere o código (tempo constante, uso único, no máximo 5 tentativas por código). Sucesso cria a sessão própria
 * do portal e grava o cookie httpOnly. Qualquer falha devolve a MESMA mensagem genérica.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkOrigin } from '@/lib/portal/origin'
import { extractIP } from '@/lib/portal/validate'
import { normalizarDocumento } from '@/lib/portal-cliente/documento'
import { codigoComFormatoValido } from '@/lib/portal-cliente/codigo'
import { portalDb } from '@/lib/portal-cliente/db'
import { aplicarLimites, LIMITES } from '@/lib/portal-cliente/anti-abuso'
import { concluirLogin, verificarCodigo } from '@/lib/portal-cliente/login'
import { opcoesCookie } from '@/lib/portal-cliente/sessao'
import { normalizarTempo } from '@/lib/portal-cliente/tempo'
import { json, lerCorpoJson, portalIndisponivel } from '@/lib/portal-cliente/http'
import { PortalIndisponivel } from '@/lib/portal-cliente/segredos'
import { COOKIE_SESSAO, TEMPO_MINIMO_LOGIN_MS } from '@/lib/portal-cliente/constantes'

const ERRO_GENERICO = 'Código inválido ou expirado. Confira os números ou peça um novo código.'

async function tratar(request: NextRequest): Promise<NextResponse> {
  const lido = await lerCorpoJson(request)
  if ('erro' in lido) return lido.erro

  const doc = normalizarDocumento(lido.corpo.documento)
  const codigo = lido.corpo.codigo
  if (!doc.ok || !codigoComFormatoValido(codigo)) return json({ error: ERRO_GENERICO }, 401)

  try {
    const db = portalDb()
    const ip = extractIP(request)
    const limite = await aplicarLimites(db, [LIMITES.verificarPorDocumento(doc.digitos), LIMITES.verificarPorIp(ip)])
    if (!limite.ok) return json({ error: 'Muitas tentativas. Aguarde um pouco e tente de novo.' }, 429)

    const ok = await verificarCodigo(db, doc.digitos, codigo)
    if (!ok) return json({ error: ERRO_GENERICO }, 401)

    const sessao = await concluirLogin(db, ok.clienteId, { ip, userAgent: request.headers.get('user-agent') })
    const resposta = json({ ok: true })
    resposta.cookies.set(COOKIE_SESSAO, sessao.token, opcoesCookie(sessao.expiraEm))
    return resposta
  } catch (e) {
    if (e instanceof PortalIndisponivel) return portalIndisponivel()
    console.error('[portal] erro em auth/verificar')
    return json({ error: ERRO_GENERICO }, 401)
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
