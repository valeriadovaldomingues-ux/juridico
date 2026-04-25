import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'
const ALLOWED: UserRole[] = ['estagiario','administrativo','advogado','gerente','socio']
export async function GET(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(req.url)
  const onlyUnread = searchParams.get('unread') === 'true'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
  const supabase = await createClient()
  let query = supabase.from('notifications').select('*').eq('user_id', auth.userId).order('created_at', { ascending: false }).limit(limit)
  if (onlyUnread) query = query.eq('is_read', false)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}