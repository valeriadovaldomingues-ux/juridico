/**
 * POST /api/agenda-items/bulk
 * Operações em lote: excluir, concluir ou remarcar múltiplos itens.
 *
 * Body:
 *   { action: 'delete'|'complete'|'reschedule', ids: string[], data_inicio?: string, hora_inicio?: string }
 *
 * Permissões:
 *   delete     → administrativo, advogado, gerente, sócio
 *   complete   → todos os perfis autenticados
 *   reschedule → todos os perfis autenticados
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const ALL_ROLES:    UserRole[] = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio']
const DELETE_ROLES: UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']

export async function POST(req: NextRequest) {
  // Qualquer usuário autenticado pode chamar — permissão por ação abaixo
  const auth = await apiGuard(ALL_ROLES)
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => ({}))
  const { action, ids, data_inicio, hora_inicio } = body as {
    action:      string
    ids:         string[]
    data_inicio?: string
    hora_inicio?: string
  }

  if (!action || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'action e ids são obrigatórios' }, { status: 400 })
  }

  if (ids.length > 200) {
    return NextResponse.json({ error: 'Máximo de 200 itens por operação' }, { status: 400 })
  }

  const supabase = await createClient()
  const now = new Date().toISOString()

  // ── Delete em lote ──────────────────────────────────────────────────────────
  if (action === 'delete') {
    // Verifica permissão de exclusão
    if (!DELETE_ROLES.includes(auth.role)) {
      return NextResponse.json({ error: 'Sem permissão para excluir itens' }, { status: 403 })
    }

    const { error } = await supabase
      .from('agenda_items')
      .update({ deleted_at: now, deleted_by: auth.userId })
      .in('id', ids)
      .is('deleted_at', null) // não re-deleta já deletados

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('agenda_audit_log').insert({
      acao:       'bulk_delete',
      item_ids:   ids,
      usuario_id: auth.userId,
      detalhes:   { total: ids.length },
    })

    return NextResponse.json({ ok: true, processed: ids.length })
  }

  // ── Concluir em lote ────────────────────────────────────────────────────────
  if (action === 'complete') {
    const { error } = await supabase
      .from('agenda_items')
      .update({ status: 'concluido' })
      .in('id', ids)
      .is('deleted_at', null)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('agenda_audit_log').insert({
      acao:       'bulk_complete',
      item_ids:   ids,
      usuario_id: auth.userId,
      detalhes:   { total: ids.length },
    })

    return NextResponse.json({ ok: true, processed: ids.length })
  }

  // ── Remarcar em lote ────────────────────────────────────────────────────────
  if (action === 'reschedule') {
    if (!data_inicio) {
      return NextResponse.json({ error: 'data_inicio é obrigatória para remarcar' }, { status: 400 })
    }

    const patch: Record<string, unknown> = { data_inicio }
    if (hora_inicio) patch.hora_inicio = hora_inicio

    const { error } = await supabase
      .from('agenda_items')
      .update(patch)
      .in('id', ids)
      .is('deleted_at', null)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('agenda_audit_log').insert({
      acao:       'bulk_reschedule',
      item_ids:   ids,
      usuario_id: auth.userId,
      detalhes:   { total: ids.length, nova_data: data_inicio, nova_hora: hora_inicio ?? null },
    })

    return NextResponse.json({ ok: true, processed: ids.length })
  }

  return NextResponse.json({ error: `Ação desconhecida: ${action}` }, { status: 400 })
}
