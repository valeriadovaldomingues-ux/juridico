import { NextResponse }         from 'next/server'
import { createClient }          from '@/lib/supabase/server'
import { createClient as svcClient } from '@supabase/supabase-js'
import type { UserRole }         from '@/types'

// ── Service client singleton ──────────────────────────────────────────────────
// Mesmo padrão do proxy.ts: service role bypassa RLS para queries de profiles,
// necessário porque @supabase/ssr v0.9.0 não propaga o JWT ao PostgREST.
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
 * Valida sessão e papel do usuário em API Routes.
 * Retorna { role, userId } quando autorizado,
 * ou um NextResponse de erro para retornar imediatamente.
 *
 * @example
 * const auth = await apiGuard(['socio', 'gerente'])
 * if (auth instanceof NextResponse) return auth
 * const { role, userId } = auth
 */
export async function apiGuard(allowedRoles: UserRole[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Usa service role para contornar bug de JWT propagation do @supabase/ssr v0.9.0
  const client = getServiceClient() ?? supabase
  const { data: profile } = await client
    .from('profiles')
    .select('role, ativo')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !profile.ativo) {
    return NextResponse.json({ error: 'Conta inativa ou não encontrada' }, { status: 403 })
  }

  if (!allowedRoles.includes(profile.role as UserRole)) {
    return NextResponse.json({ error: 'Sem permissão para esta operação' }, { status: 403 })
  }

  return { role: profile.role as UserRole, userId: user.id }
}
