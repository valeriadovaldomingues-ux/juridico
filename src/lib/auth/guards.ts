import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Profile, UserRole } from '@/types'

/**
 * Busca o perfil do usuário autenticado na sessão atual.
 * Retorna null se não houver sessão ativa.
 */
export async function getSessionProfile(): Promise<{ profile: Profile; userId: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!data) return null
  return { profile: data as Profile, userId: user.id }
}

/**
 * Garante que há uma sessão ativa.
 * Redireciona para /login se não houver.
 */
export async function requireAuth() {
  const result = await getSessionProfile()
  if (!result) redirect('/login')
  return result
}

/**
 * Garante que o usuário autenticado possui um dos papéis permitidos.
 * Redireciona para /dashboard se o papel não for suficiente.
 *
 * Uso:
 *   const { profile } = await requireRole(['socio'])
 *   const { profile } = await requireRole(['gerente', 'socio'])
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const result = await requireAuth()
  if (!allowedRoles.includes(result.profile.role)) {
    redirect('/dashboard')
  }
  return result
}

/**
 * Retorna o Profile do usuário autenticado, ou null se não houver sessão.
 * Atalho conveniente para uso em Server Components e Server Actions.
 */
export async function getCurrentUser() {
  const result = await getSessionProfile()
  return result?.profile ?? null
}

/**
 * Verifica se o usuário autenticado tem permissão para uma ação em um módulo.
 * Usa a mesma fonte de verdade de permissions.ts.
 *
 * @example
 * const ok = await hasPermission('financeiro', 'view')
 * const ok = await hasPermission('usuarios', 'delete')
 */
export async function hasPermission(module: import('@/lib/permissions').Module, action: import('@/lib/permissions').Action = 'view') {
  const result = await getSessionProfile()
  if (!result) return false
  const { can } = await import('@/lib/permissions')
  return can(result.profile.role, module, action)
}
