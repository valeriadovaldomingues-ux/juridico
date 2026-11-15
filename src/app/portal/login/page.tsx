import { redirect } from 'next/navigation'
import { getPortalSession } from '@/lib/auth/portal-guard'
import PortalLoginForm from './PortalLoginForm'

/** Só aceita voltar para dentro do portal (evita redirecionamento para fora). */
function destinoSeguro(next: string | string[] | undefined): string {
  const v = Array.isArray(next) ? next[0] : next
  return v && /^\/portal(\/[A-Za-z0-9._~\-/]*)?$/.test(v) && !v.startsWith('/portal/login') ? v : '/portal'
}

export default async function PortalLoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams
  const destino = destinoSeguro(next)
  // Já entrou? Vai direto para o portal.
  if (await getPortalSession()) redirect(destino)
  return <PortalLoginForm destino={destino} />
}
