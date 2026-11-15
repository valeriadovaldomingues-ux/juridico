/** POST /api/portal/auth/sair — revoga a sessão do cookie e apaga o cookie. */

import { NextRequest } from 'next/server'
import { checkOrigin } from '@/lib/portal/origin'
import { portalDb } from '@/lib/portal-cliente/db'
import { revogarToken } from '@/lib/portal-cliente/sessao'
import { registrarLogPortal } from '@/lib/portal-cliente/log'
import { json } from '@/lib/portal-cliente/http'
import { COOKIE_SESSAO } from '@/lib/portal-cliente/constantes'

export async function POST(request: NextRequest) {
  const bloqueado = checkOrigin(request)
  if (bloqueado) return bloqueado

  const token = request.cookies.get(COOKIE_SESSAO)?.value
  if (token) {
    try {
      const db = portalDb()
      await revogarToken(db, token)
      await registrarLogPortal(db, { acao: 'logout' })
    } catch {
      // sem banco/tabela: o cookie é apagado mesmo assim
    }
  }
  const resposta = json({ ok: true })
  resposta.cookies.set(COOKIE_SESSAO, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 })
  return resposta
}
