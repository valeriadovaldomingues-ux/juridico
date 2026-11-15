import { redirect } from 'next/navigation'
import { getPortalSession, type PortalSession } from '@/lib/auth/portal-guard'
import { portalDb } from './db'
import { ROTA_LOGIN_PORTAL } from './constantes'
import type { Db } from './db'

/**
 * Para as páginas do portal: devolve a sessão do cliente + o client de banco (service role) ou manda para o login.
 * A página SEMPRE usa session.clienteId nas consultas; nunca um id vindo da URL sem checar que é do cliente.
 */
export async function exigirSessaoPortal(): Promise<{ session: PortalSession; db: Db }> {
  const session = await getPortalSession()
  if (!session) redirect(ROTA_LOGIN_PORTAL)
  return { session, db: portalDb() }
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** "2026-11-20" ou ISO com hora → "20 de novembro de 2026" (sem deslocar o dia por fuso). */
export function dataPorExtenso(valor: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor ?? '')
  return m ? `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}` : ''
}

export function dataCurta(valor: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor ?? '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}
