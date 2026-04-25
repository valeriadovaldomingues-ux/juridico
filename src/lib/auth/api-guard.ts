import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, ativo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.ativo) {
    return NextResponse.json({ error: 'Conta inativa ou não encontrada' }, { status: 403 })
  }

  if (!allowedRoles.includes(profile.role as UserRole)) {
    return NextResponse.json({ error: 'Sem permissão para esta operação' }, { status: 403 })
  }

  return { role: profile.role as UserRole, userId: user.id }
}
