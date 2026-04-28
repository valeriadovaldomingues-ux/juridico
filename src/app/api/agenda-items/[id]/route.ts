import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'

const DELETE_ROLES = ['administrativo', 'advogado', 'gerente', 'socio'] as const
const UPDATE_ROLES = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'] as const

/**
 * PATCH /api/agenda-items/:id
 * Atualização rápida de campos: status, data, hora, etc.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard([...UPDATE_ROLES])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID ausente' }, { status: 400 })

  const body = await request.json().catch(() => ({}))

  const allowed = ['status', 'data_inicio', 'hora_inicio', 'data_fim', 'prazo_final',
    'titulo', 'descricao', 'prioridade', 'responsavel', 'processo_id', 'cliente_id']
  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agenda_items')
    .update(patch)
    .eq('id', id)
    .select('id, titulo, status, data_inicio')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/**
 * DELETE /api/agenda-items/:id
 * Soft delete — registra deleted_at e deleted_by sem remover fisicamente.
 * Requer perfil administrativo ou superior.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard([...DELETE_ROLES])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID ausente' }, { status: 400 })

  const supabase = await createClient()
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('agenda_items')
    .update({ deleted_at: now, deleted_by: auth.userId })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('agenda_audit_log').insert({
    acao:       'delete',
    item_ids:   [id],
    usuario_id: auth.userId,
    detalhes:   { tipo: 'individual' },
  })

  return new NextResponse(null, { status: 204 })
}
