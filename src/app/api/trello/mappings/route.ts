import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['gerente', 'socio']

/** GET /api/trello/mappings — retorna mapeamentos salvos da integração ativa */
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

  if (!integration) return NextResponse.json({ lists: [], members: [] })

  const [{ data: lists }, { data: members }] = await Promise.all([
    supabase.from('trello_list_mappings').select('*').eq('integration_id', integration.id),
    supabase.from('trello_member_mappings').select('*').eq('integration_id', integration.id),
  ])

  return NextResponse.json({ lists: lists ?? [], members: members ?? [] })
}

/**
 * POST /api/trello/mappings — salva (substitui) todos os mapeamentos da integração ativa
 *
 * Body: {
 *   lists:   { trello_list_id, trello_list_name, kanban_status }[]
 *   members: { trello_member_id, trello_username, trello_full_name, profile_id }[]
 * }
 */
export async function POST(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const { lists = [], members = [] } = await req.json()

  const supabase = await createClient()

  const { data: integration } = await supabase
    .from('trello_integrations')
    .select('id')
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!integration) return NextResponse.json({ error: 'Nenhuma integração configurada' }, { status: 404 })

  const id = integration.id

  // Substituir mapeamentos: delete → insert
  await Promise.all([
    supabase.from('trello_list_mappings').delete().eq('integration_id', id),
    supabase.from('trello_member_mappings').delete().eq('integration_id', id),
  ])

  const [listRes, memberRes] = await Promise.all([
    lists.length > 0
      ? supabase.from('trello_list_mappings').insert(
          lists.map((l: { trello_list_id: string; trello_list_name: string; kanban_status: string }) => ({
            integration_id:   id,
            trello_list_id:   l.trello_list_id,
            trello_list_name: l.trello_list_name,
            kanban_status:    l.kanban_status,
          }))
        )
      : Promise.resolve({ error: null }),

    members.length > 0
      ? supabase.from('trello_member_mappings').insert(
          members.map((m: { trello_member_id: string; trello_username: string; trello_full_name: string; profile_id: string | null }) => ({
            integration_id:   id,
            trello_member_id: m.trello_member_id,
            trello_username:  m.trello_username,
            trello_full_name: m.trello_full_name,
            profile_id:       m.profile_id || null,
          }))
        )
      : Promise.resolve({ error: null }),
  ])

  if (listRes.error)   return NextResponse.json({ error: listRes.error.message },   { status: 500 })
  if (memberRes.error) return NextResponse.json({ error: memberRes.error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
