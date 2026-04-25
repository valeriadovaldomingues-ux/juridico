// ─────────────────────────────────────────────────────────────────────────────
// src/lib/agenda-import/sync-to-kanban.ts
//
// Sincroniza um item de agenda com o Kanban do escritório.
//
// Regras:
//   - Uma task por agenda_item (dedup por agenda_item_id + índice único no DB)
//   - INSERT: cria a task com status 'a_fazer'
//   - UPDATE: atualiza titulo, descricao, data, responsavel e prioridade
//   - Prioridade calculada automaticamente pelo prazo
//   - Erros de constraint unique (23505) são silenciados — já existe
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type { NormalizedAgendaRow } from '@/types/agenda-import'
import type { KanbanPrioridade } from '@/types/kanban'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calcula prioridade com base no prazo (ou data do evento se não houver prazo).
 *
 * Lógica:
 *   vencido          → urgente
 *   hoje             → alta
 *   até 7 dias       → alta
 *   mais de 7 dias   → media
 *   sem data         → media
 */
function calcPrioridade(
  prazoFinal: string | null,
  dataInicio: string,
): KanbanPrioridade {
  const ref = prazoFinal ?? dataInicio
  if (!ref) return 'media'

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const prazo = new Date(ref)

  if (prazo < hoje) return 'urgente'

  const diffMs   = prazo.getTime() - hoje.getTime()
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDias === 0) return 'alta'
  if (diffDias <= 7)  return 'alta'
  return 'media'
}

/**
 * Monta a descrição da task incluindo dados do processo e partes.
 *
 * Formato:
 *   <descricao original>
 *   Processo: <numero>
 *   Cliente: <nome>
 *   Parte contrária: <nome>
 */
function buildDescricao(row: NormalizedAgendaRow): string | null {
  const partes: string[] = []

  if (row.descricao)           partes.push(row.descricao)
  if (row.process_number)      partes.push(`Processo: ${row.process_number}`)
  if (row.client_name)         partes.push(`Cliente: ${row.client_name}`)
  if (row.opposing_party_name) partes.push(`Parte contrária: ${row.opposing_party_name}`)

  return partes.length > 0 ? partes.join('\n') : null
}

/**
 * Resume cliente e parte contrária em uma única string "A × B".
 * Usada no campo partes_resumidas do kanban.
 */
function buildPartesResumidas(row: NormalizedAgendaRow): string | null {
  const partes = [row.client_name, row.opposing_party_name].filter(Boolean)
  return partes.length > 0 ? partes.join(' × ') : null
}

// ─── Função principal ─────────────────────────────────────────────────────────

export type SyncOperation = 'insert' | 'update'

/**
 * Sincroniza um agenda_item com o kanban.
 *
 * @param supabase      - Cliente Supabase autenticado (server-side)
 * @param agendaItemId  - ID do registro recém-criado/atualizado em agenda_items
 * @param row           - Linha normalizada (com responsible_user_id já resolvido)
 * @param operation     - 'insert' cria nova task; 'update' atualiza existente
 */
export async function syncAgendaToKanban(
  supabase:     SupabaseClient,
  agendaItemId: string,
  row:          NormalizedAgendaRow,
  operation:    SyncOperation = 'insert',
): Promise<void> {
  const prioridade = calcPrioridade(row.prazo_final, row.data_inicio)

  const taskData = {
    titulo:           row.titulo,
    descricao:        buildDescricao(row),
    status:           'a_fazer' as const,
    prioridade,
    data:             row.prazo_final ?? row.data_inicio,
    responsavel_id:   row.responsible_user_id ?? null,
    responsavel:      row.responsible_name    ?? null,
    numero_processo:  row.process_number      ?? null,
    partes_resumidas: buildPartesResumidas(row),
    origem:           'agenda' as const,
    agenda_item_id:   agendaItemId,
    ordem:            0,
  }

  if (operation === 'update') {
    // Atualiza a task existente vinculada a este agenda_item
    const { error } = await supabase
      .from('kanban_tasks')
      .update({
        titulo:           taskData.titulo,
        descricao:        taskData.descricao,
        data:             taskData.data,
        prioridade:       taskData.prioridade,
        responsavel_id:   taskData.responsavel_id,
        responsavel:      taskData.responsavel,
        numero_processo:  taskData.numero_processo,
        partes_resumidas: taskData.partes_resumidas,
        updated_at:       new Date().toISOString(),
      })
      .eq('origem', 'agenda')
      .eq('agenda_item_id', agendaItemId)

    if (error) {
      console.error('[syncAgendaToKanban] erro ao atualizar task:', {
        agendaItemId,
        error,
      })
    }
    return
  }

  // INSERT: cria nova task
  const { error } = await supabase
    .from('kanban_tasks')
    .insert(taskData)

  if (error) {
    if (error.code === '23505') {
      // Violação do índice único (origem, agenda_item_id) — task já existe, ok
      return
    }
    console.error('[syncAgendaToKanban] erro ao criar task:', {
      agendaItemId,
      error,
    })
  }
}
