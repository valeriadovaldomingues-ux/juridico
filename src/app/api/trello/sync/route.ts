import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { syncTrelloBoard } from '@/lib/trello/sync'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['gerente', 'socio']

/** POST /api/trello/sync — dispara sincronização manual */
export async function POST() {
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

  if (!integration) return NextResponse.json({ error: 'Nenhuma integração configurada' }, { status: 404 })

  // Verificar se já há sync em andamento
  const { data: running } = await supabase
    .from('trello_sync_logs')
    .select('id')
    .eq('integration_id', integration.id)
    .eq('status', 'em_andamento')
    .maybeSingle()

  if (running) return NextResponse.json({ error: 'Já há uma sincronização em andamento' }, { status: 409 })

  try {
    const result = await syncTrelloBoard(integration.id, auth.userId)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro na sincronização'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
