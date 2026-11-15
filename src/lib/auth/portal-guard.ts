import { cache } from 'react'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { portalDb } from '@/lib/portal-cliente/db'
import { validarToken, type SessaoPortal } from '@/lib/portal-cliente/sessao'
import { COOKIE_SESSAO } from '@/lib/portal-cliente/constantes'
import { PortalIndisponivel } from '@/lib/portal-cliente/segredos'

export type PortalSession = SessaoPortal

/**
 * Sessão do cliente no portal, lida do cookie PRÓPRIO (token opaco; o banco guarda só o hash).
 * Não usa Supabase Auth: o cliente nunca tem JWT. Devolve null se o cookie não existe, é inválido,
 * está expirado/revogado, ou se o acesso do cliente foi revogado. Memoizada por requisição.
 */
export const getPortalSession = cache(async (): Promise<PortalSession | null> => {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value
  if (!token) return null
  try {
    return await validarToken(portalDb(), token)
  } catch (e) {
    if (e instanceof PortalIndisponivel) return null
    throw e
  }
})

/**
 * Guard para as API Routes do portal (/api/portal/*, exceto /auth).
 * Retorna a sessão (com o clienteId) ou um NextResponse 401 para devolver na hora.
 *
 * @example
 * const session = await portalGuard()
 * if (session instanceof NextResponse) return session
 * const { clienteId } = session   // SEMPRE filtre por este clienteId; nunca confie em id da URL.
 */
export async function portalGuard(): Promise<PortalSession | NextResponse> {
  const session = await getPortalSession()
  if (!session) {
    return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 })
  }
  return session
}
