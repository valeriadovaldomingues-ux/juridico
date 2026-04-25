// POST /api/contact-interactions — cria uma interação
// DELETE /api/contact-interactions?id=<uuid> — remove uma interação

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole, TipoInteracao } from '@/types'

const ALLOWED: UserRole[] = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio']

const TIPOS_VALIDOS: TipoInteracao[] = [
  'ligacao', 'reuniao', 'email', 'mensagem', 'observacao', 'tarefa_concluida',
]

export async function POST(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  let body: { cliente_id: string; tipo: TipoInteracao; descricao: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { cliente_id, tipo, descricao } = body

  if (!cliente_id || typeof cliente_id !== 'string') {
    return NextResponse.json({ error: 'cliente_id obrigatório' }, { status: 400 })
  }
  if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
  }
  if (!descricao || typeof descricao !== 'string' || descricao.trim().length === 0) {
    return NextResponse.json({ error: 'descricao obrigatória' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('contact_interactions')
    .insert({ cliente_id, tipo, descricao: descricao.trim(), usuario_id: auth.userId })
    .select('*, usuario:profiles(id, nome, role)')
    .single()

  if (error) {
    console.error('[contact-interactions POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const supabase = await createClient()

  // Apenas quem criou ou gerente/socio pode deletar
  const { data: interaction } = await supabase
    .from('contact_interactions')
    .select('usuario_id')
    .eq('id', id)
    .single()

  if (!interaction) {
    return NextResponse.json({ error: 'Interação não encontrada' }, { status: 404 })
  }

  const canDelete =
    interaction.usuario_id === auth.userId ||
    auth.role === 'gerente' ||
    auth.role === 'socio'

  if (!canDelete) {
    return NextResponse.json({ error: 'Sem permissão para remover esta interação' }, { status: 403 })
  }

  const { error } = await supabase.from('contact_interactions').delete().eq('id', id)

  if (error) {
    console.error('[contact-interactions DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
