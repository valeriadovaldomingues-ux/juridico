import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface PortalSession {
  userId:      string
  clienteId:   string
  clienteNome: string
}

/**
 * Guard para API Routes do portal do cliente (/api/portal/*).
 *
 * Valida:
 *   1. Sessão Supabase ativa
 *   2. Role = 'cliente'
 *   3. Vínculo ativo em portal_clientes
 *
 * Retorna PortalSession quando autorizado,
 * ou NextResponse de erro para retornar imediatamente.
 *
 * @example
 * const session = await portalGuard()
 * if (session instanceof NextResponse) return session
 * const { clienteId } = session
 */
export async function portalGuard(): Promise<PortalSession | NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  // Busca perfil e valida role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, ativo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.ativo) {
    return NextResponse.json({ error: 'Conta inativa ou não encontrada' }, { status: 403 })
  }

  if (profile.role !== 'cliente') {
    return NextResponse.json({ error: 'Acesso exclusivo ao portal do cliente' }, { status: 403 })
  }

  // Busca vínculo portal_clientes ativo
  const { data: portalCliente } = await supabase
    .from('portal_clientes')
    .select('cliente_id, clientes(nome)')
    .eq('auth_user_id', user.id)
    .eq('ativo', true)
    .single()

  if (!portalCliente) {
    return NextResponse.json(
      { error: 'Vínculo de cliente não encontrado ou inativo' },
      { status: 403 },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clienteNome: string = (portalCliente as any).clientes?.nome
    ?? (portalCliente as any).clientes?.[0]?.nome
    ?? ''

  return {
    userId:      user.id,
    clienteId:   portalCliente.cliente_id as string,
    clienteNome,
  }
}
