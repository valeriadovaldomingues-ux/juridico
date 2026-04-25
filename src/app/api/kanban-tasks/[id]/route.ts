import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { calculateSimpleSLA } from '@/lib/kanban-sla'

const ALLOWED: import('@/types').UserRole[] = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio']

/** PATCH /api/kanban-tasks/:id — atualiza status, responsável, ordem ou campos do card */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID ausente' }, { status: 400 })

  const body = await request.json()
  const supabase = await createClient()

  // Busca estado atual para registrar histórico e recalcular SLA
  const { data: current } = await supabase
    .from('kanban_tasks')
    .select('status, responsavel_id, tipo, origem, data, prioridade, sla_due_at, created_at')
    .eq('id', id)
    .single()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  const allowedFields = [
    'titulo', 'descricao', 'tipo', 'status', 'prioridade', 'responsavel_id',
    'processo_id', 'numero_processo', 'partes_resumidas', 'area_juridica',
    'pendencia_motivo', 'publicacao_id', 'origem', 'data', 'ordem',
  ]
  for (const f of allowedFields) {
    if (f in body) updates[f] = body[f]
  }

  // Se concluindo, registra timestamp
  if (body.status === 'concluido' && current?.status !== 'concluido') {
    updates.concluido_em = new Date().toISOString()
  } else if (body.status && body.status !== 'concluido') {
    updates.concluido_em = null
  }

  // ── Recalcular SLA ─────────────────────────────────────────────────────────
  // Recalcula sempre que qualquer campo relevante (status, data, tipo, origem,
  // prioridade) mudar — função é barata, sem IO.
  const slaInputMudou = ['status', 'data', 'tipo', 'origem', 'prioridade'].some(f => f in body)

  if (current && slaInputMudou) {
    const sla = calculateSimpleSLA({
      tipo:       (updates.tipo       ?? current.tipo)       as string | null,
      origem:     (updates.origem     ?? current.origem)     as string,
      data:       (updates.data       ?? current.data)       as string | null,
      status:     (updates.status     ?? current.status)     as string,
      prioridade: (updates.prioridade ?? current.prioridade) as string | null,
    })
    updates.sla_level  = sla.sla_level
    updates.sla_due_at = sla.sla_due_at
  }

  const { data, error } = await supabase
    .from('kanban_tasks')
    .update(updates)
    .eq('id', id)
    .select(`*, responsavel:profiles!responsavel_id(id, nome, cor_kanban), processo:processos!processo_id(id, titulo, numero_processo)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Registrar histórico de movimentação
  const statusMudou      = body.status && current?.status !== body.status
  const responsavelMudou = 'responsavel_id' in body && current?.responsavel_id !== body.responsavel_id

  // Detectar edição de outros campos (titulo, descricao, prioridade, data, etc.)
  const camposEdicao = ['titulo', 'descricao', 'prioridade', 'data', 'area_juridica', 'pendencia_motivo']
  const outrosCamposMudaram = camposEdicao.some(f => f in body)

  const acao = statusMudou && responsavelMudou ? 'status_responsavel'
             : statusMudou                     ? 'status'
             : responsavelMudou                ? 'responsavel'
             : outrosCamposMudaram             ? 'edicao'
             : null

  if (acao) {
    await supabase.from('kanban_historico').insert({
      task_id:             id,
      usuario_id:          auth.userId,
      acao,
      de_status:           statusMudou ? current?.status : null,
      para_status:         statusMudou ? body.status : null,
      de_responsavel_id:   responsavelMudou ? current?.responsavel_id : null,
      para_responsavel_id: responsavelMudou ? body.responsavel_id : null,
    })
  }

  return NextResponse.json(data)
}

/** DELETE /api/kanban-tasks/:id */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID ausente' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase.from('kanban_tasks').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
