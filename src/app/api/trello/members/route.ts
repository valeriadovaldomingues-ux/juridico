import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { fetchMembers } from '@/lib/trello/api'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['gerente', 'socio']

/** GET /api/trello/members — busca membros do board no Trello (usando credenciais salvas) */
export async function GET() {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()

  const { data: integration } = await supabase
    .from('trello_integrations')
    .select('*')
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!integration) return NextResponse.json({ error: 'Nenhuma integração configurada' }, { status: 404 })

  try {
    const members = await fetchMembers(integration.board_id, integration.api_key, integration.api_token)
    return NextResponse.json(members)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao buscar membros'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
