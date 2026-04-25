import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['gerente', 'socio']

/** GET /api/trello/sync-logs — últimos 20 logs de sincronização */
export async function GET() {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()

  const { data: integration } = await supabase
    .from('trello_integrations')
    .select('id')
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!integration) return NextResponse.json([])

  const { data, error } = await supabase
    .from('trello_sync_logs')
    .select(`
      *,
      triggered_by_profile:profiles!triggered_by(nome)
    `)
    .eq('integration_id', integration.id)
    .order('started_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
