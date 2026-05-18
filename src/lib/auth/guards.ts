import { createClient }          from '@/lib/supabase/server'
import { createClient as svcClient } from '@supabase/supabase-js'
import { redirect }               from 'next/navigation'
import type { Profile, UserRole } from '@/types'

// ── Service client singleton ──────────────────────────────────────────────────
// Mesmo padrão do proxy.ts: service role bypassa RLS para queries de profiles,
// necessário porque @supabase/ssr v0.9.0 não propaga o JWT ao PostgREST
// em nenhum contexto (nem Edge Runtime nem Server Components).
let _svc: ReturnType<typeof svcClient> | null = null

function getServiceClient() {
  if (_svc) return _svc
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  _svc = svcClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return _svc
}

/**
 * Busca o perfil do usuário autenticado na sessão atual.
 * Usa service role para contornar bug de JWT propagation em @supabase/ssr v0.9.0.
 * Retorna null se não houver sessão ativa.
 */
export async function getSessionProfile(): Promise<{ profile: Profile; userId: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const client = getServiceClient() ?? supabase
  const { data } = await client
    .from('profiles')
    .select('id, nome, email, role, ativo, created_at, cor_kanban, data_nascimento, ignore_birthday')
    .eq('id', user.id)
    .maybeSingle()

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
 * Regra de negócio: ROLE=socio tem acesso irrestrito a TODAS as rotas internas.
 * O bypass de socio é aplicado aqui para que páginas novas herdem a regra
 * automaticamente, sem depender de cada requireRole incluir 'socio' manualmente.
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const result = await requireAuth()

  // Sócio tem acesso irrestrito a todas as rotas internas do sistema.
  if (result.profile.role === 'socio') return result

  if (!allowedRoles.includes(result.profile.role)) {
    redirect('/dashboard')
  }
  return result
}

/**
 * Retorna o Profile do usuário autenticado, ou null se não houver sessão.
 */
export async function getCurrentUser() {
  const result = await getSessionProfile()
  return result?.profile ?? null
}

/**
 * Verifica se o usuário autenticado tem permissão para uma ação em um módulo.
 */
export async function hasPermission(
  module: import('@/lib/permissions').Module,
  action: import('@/lib/permissions').Action = 'view',
) {
  const result = await getSessionProfile()
  if (!result) return false
  const { can } = await import('@/lib/permissions')
  return can(result.profile.role, module, action)
}
