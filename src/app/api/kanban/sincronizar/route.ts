import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { apiGuard } from '@/lib/auth/api-guard'
import { liberarSincronizacoesTravadas, syncTrelloBoard } from '@/lib/trello/sync'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['estagiario', 'comercial', 'administrativo', 'advogado', 'gerente', 'socio']

// Intervalo mínimo entre sincronizações: o Kanban sincroniza ao abrir e ao voltar para a aba,
// então várias pessoas abrindo juntas não podem disparar uma sincronização cada.
const INTERVALO_AUTOMATICO_MS = 2 * 60_000
const INTERVALO_MANUAL_MS = 30_000

export const maxDuration = 300

/**
 * POST /api/kanban/sincronizar — atualiza o Kanban a partir do Trello, para qualquer pessoa da equipe.
 * O workflow agendado do GitHub dispara só 2–3 vezes por dia, então a tela pede a atualização sozinha.
 * Body opcional: { manual: true } (botão "Atualizar do Trello") usa um intervalo mínimo menor.
 */
export async function POST(request: Request) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => ({}))
  const intervalo = body?.manual === true ? INTERVALO_MANUAL_MS : INTERVALO_AUTOMATICO_MS

  // Service role: a RLS de trello_* e kanban_tasks é restrita a gerente/sócio, e a sincronização grava nelas
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: integration } = await supabase
    .from('trello_integrations')
    .select('id')
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!integration) return NextResponse.json({ status: 'sem_integracao' })

  await liberarSincronizacoesTravadas(supabase, integration.id)

  const { data: emAndamento } = await supabase
    .from('trello_sync_logs')
    .select('id')
    .eq('integration_id', integration.id)
    .eq('status', 'em_andamento')
    .limit(1)
    .maybeSingle()

  if (emAndamento) return NextResponse.json({ status: 'em_andamento' })

  const { data: ultima } = await supabase
    .from('trello_sync_logs')
    .select('finished_at')
    .eq('integration_id', integration.id)
    .eq('status', 'sucesso')
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (ultima?.finished_at && Date.now() - new Date(ultima.finished_at).getTime() < intervalo) {
    return NextResponse.json({ status: 'recente' })
  }

  try {
    await syncTrelloBoard(integration.id, auth.userId, supabase)
    return NextResponse.json({ status: 'sincronizado' })
  } catch (err) {
    console.error('[kanban/sincronizar]', err)
    return NextResponse.json({ error: 'Não foi possível sincronizar com o Trello agora.' }, { status: 502 })
  }
}
