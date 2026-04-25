import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/guards'
import TrelloIntegracaoPage from './TrelloIntegracaoPage'
import type { TrelloIntegration } from '@/types/trello'

export default async function TrelloPage() {
  await requireRole(['gerente', 'socio'])
  const supabase = await createClient()

  const { data: integration } = await supabase
    .from('trello_integrations')
    .select('id, board_id, board_name, ativo, created_at, updated_at')
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const integrationId = integration?.id ?? null

  const [{ data: listMappings }, { data: memberMappings }, { data: profiles }, { data: recentLogs }] =
    await Promise.all([
      integrationId
        ? supabase.from('trello_list_mappings').select('*').eq('integration_id', integrationId)
        : Promise.resolve({ data: [] }),

      integrationId
        ? supabase.from('trello_member_mappings').select('*').eq('integration_id', integrationId)
        : Promise.resolve({ data: [] }),

      supabase.from('profiles').select('id, nome').eq('ativo', true).order('nome'),

      integrationId
        ? supabase
            .from('trello_sync_logs')
            .select('*, triggered_by_profile:profiles!triggered_by(nome)')
            .eq('integration_id', integrationId)
            .order('started_at', { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] }),
    ])

  // Cast seguro — api_key e api_token não são expostos pela query (intencionalmente omitidos na UI)
  const safeIntegration = integration as TrelloIntegration | null

  return (
    <TrelloIntegracaoPage
      initialIntegration={safeIntegration}
      initialListMappings={listMappings ?? []}
      initialMemberMappings={memberMappings ?? []}
      profiles={profiles ?? []}
      initialLogs={recentLogs ?? []}
    />
  )
}
