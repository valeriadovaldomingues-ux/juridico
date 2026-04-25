import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { fetchBoard } from '@/lib/trello/api'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['gerente', 'socio']

/** GET /api/trello/config — retorna a integração ativa */
export async function GET() {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()
  const { data } = await supabase
    .from('trello_integrations')
    .select('id, board_id, board_name, ativo, created_at, updated_at')
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json(data ?? null)
}

/** POST /api/trello/config — cria ou atualiza a integração */
export async function POST(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const { board_id, api_key, api_token } = await req.json()

  if (!board_id?.trim() || !api_key?.trim() || !api_token?.trim()) {
    return NextResponse.json({ error: 'board_id, api_key e api_token são obrigatórios' }, { status: 400 })
  }

  // Validar credenciais consultando o Trello
  let board_name: string
  try {
    const board = await fetchBoard(board_id.trim(), api_key.trim(), api_token.trim())
    board_name = board.name
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Credenciais inválidas'
    return NextResponse.json({ error: `Não foi possível conectar ao Trello: ${msg}` }, { status: 422 })
  }

  const supabase = await createClient()

  // Desativar integrações anteriores
  await supabase.from('trello_integrations').update({ ativo: false }).eq('ativo', true)

  const { data, error } = await supabase
    .from('trello_integrations')
    .insert({
      board_id:   board_id.trim(),
      api_key:    api_key.trim(),
      api_token:  api_token.trim(),
      board_name,
      ativo:      true,
      created_by: auth.userId,
      updated_at: new Date().toISOString(),
    })
    .select('id, board_id, board_name, ativo, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

/** DELETE /api/trello/config — desativa a integração */
export async function DELETE() {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()
  await supabase.from('trello_integrations').update({ ativo: false }).eq('ativo', true)
  return new NextResponse(null, { status: 204 })
}
