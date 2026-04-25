import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'
const ALLOWED: UserRole[] = ['estagiario','administrativo','advogado','gerente','socio']
export async function PATCH() {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth
  const supabase = await createClient()
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', auth.userId).eq('is_read', false)
  return new NextResponse(null, { status: 204 })
}