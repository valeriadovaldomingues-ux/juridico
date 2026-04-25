import { createClient } from '@/lib/supabase/server'
import { calculateSimpleSLA } from '@/lib/kanban-sla'
import { fetchOpenCards } from './api'
import type { KanbanPrioridade, KanbanStatus } from '@/types/kanban'
import type { TrelloLabel, SyncResult } from '@/types/trello'

// ─── Label → prioridade ───────────────────────────────────────────────────────

const COLOR_MAP: Record<string, KanbanPrioridade> = {
  red:    'urgente',
  orange: 'alta',
  yellow: 'media',
}

function derivePrioridade(labels: TrelloLabel[]): KanbanPrioridade {
  const order: KanbanPrioridade[] = ['urgente', 'alta', 'media', 'baixa']
  for (const prio of order) {
    const color = Object.entries(COLOR_MAP).find(([, v]) => v === prio)?.[0]
    if (color && labels.some(l => l.color === color)) return prio
  }
  return 'media'
}

// ─── Sync principal ───────────────────────────────────────────────────────────

export async function syncTrelloBoard(
  integrationId: string,
  triggeredBy: string,
): Promise<SyncResult> {
  const supabase = await createClient()

  // 1. Criar log "em andamento"
  const { data: logEntry, error: logErr } = await supabase
    .from('trello_sync_logs')
    .insert({ integration_id: integrationId, triggered_by: triggeredBy, status: 'em_andamento' })
    .select('id')
    .single()

  if (logErr || !logEntry) throw new Error('Não foi possível criar log de sincronização')

  const logId = logEntry.id

  async function failLog(msg: string) {
    await supabase.from('trello_sync_logs').update({
      status:        'erro',
      erro_detalhes: msg,
      finished_at:   new Date().toISOString(),
    }).eq('id', logId)
  }

  try {
    // 2. Buscar integração
    const { data: integration } = await supabase
      .from('trello_integrations')
      .select('*')
      .eq('id', integrationId)
      .single()

    if (!integration) {
      await failLog('Integração não encontrada')
      throw new Error('Integração não encontrada')
    }

    // 3. Buscar mapeamentos de listas e membros
    const [{ data: listMappings }, { data: memberMappings }] = await Promise.all([
      supabase.from('trello_list_mappings').select('*').eq('integration_id', integrationId),
      supabase.from('trello_member_mappings').select('*').eq('integration_id', integrationId),
    ])

    // Map: trello_list_id → kanban_status
    const listStatusMap = new Map(
      (listMappings ?? []).map(m => [m.trello_list_id, m.kanban_status])
    )

    // Map: trello_member_id → profile_id (nunca nulo — ausência = sem mapping)
    // Importante: só inclui membros COM profile_id definido e válido.
    // Membros sem mapping retornam undefined no .get() → responsavel_id = null.
    const memberProfMap = new Map(
      (memberMappings ?? [])
        .filter(m => m.profile_id != null)
        .map(m => [m.trello_member_id, m.profile_id as string])
    )

    // Índice auxiliar para nome legível nos avisos de log
    const memberNameMap = new Map(
      (memberMappings ?? []).map(m => [
        m.trello_member_id,
        m.trello_full_name ?? m.trello_username ?? m.trello_member_id,
      ])
    )

    // 4. Buscar cards abertos do Trello
    const cards = await fetchOpenCards(
      integration.board_id,
      integration.api_key,
      integration.api_token,
    )

    let criados = 0
    let atualizados = 0
    let ignorados = 0
    let semResponsavel = 0

    // Membros do Trello encontrados nos cards mas sem mapping configurado
    const membrosSemMapping = new Map<string, string>()   // trello_id → nome legível

    const now = new Date().toISOString()

    // 5. Processar cada card
    for (const card of cards) {
      if (card.closed) { ignorados++; continue }

      const kanbanStatus = listStatusMap.get(card.idList) as KanbanStatus | 'ignorar' | undefined
      if (!kanbanStatus || kanbanStatus === 'ignorar') { ignorados++; continue }

      // Responsável: usar apenas se houver mapping válido.
      // Nunca usar ID fallback/placeholder — se não houver mapping, null.
      const firstMemberId = card.idMembers?.[0] ?? null
      let responsavelId: string | null = null

      if (firstMemberId) {
        const mapped = memberProfMap.get(firstMemberId)
        if (mapped) {
          responsavelId = mapped
        } else {
          // Registrar membro sem mapping para exibir no resultado
          if (!membrosSemMapping.has(firstMemberId)) {
            membrosSemMapping.set(
              firstMemberId,
              memberNameMap.get(firstMemberId) ?? firstMemberId,
            )
          }
          semResponsavel++
        }
      }

      const prioridade = derivePrioridade(card.labels ?? [])
      const data       = card.due ? card.due.slice(0, 10) : null

      // Verificar se card já existe (upsert manual para contagem correta)
      const { data: existing } = await supabase
        .from('kanban_tasks')
        .select('id')
        .eq('origem', 'trello')
        .eq('origem_id', card.id)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('kanban_tasks')
          .update({
            titulo:           card.name,
            descricao:        card.desc || null,
            status:           kanbanStatus,
            responsavel_id:   responsavelId,
            trello_member_id: firstMemberId,  // persiste o ID do membro para redistribuição futura
            prioridade,
            data,
            updated_at:       now,
          })
          .eq('id', existing.id)
        atualizados++
      } else {
        // Calcular ordem no final da coluna
        const { data: maxRow } = await supabase
          .from('kanban_tasks')
          .select('ordem')
          .eq('status', kanbanStatus)
          .order('ordem', { ascending: false })
          .limit(1)
          .maybeSingle()
        const ordem = maxRow ? maxRow.ordem + 1 : 0

        const sla = calculateSimpleSLA({
          tipo: 'tarefa', origem: 'trello', data, status: kanbanStatus, prioridade,
        })

        await supabase.from('kanban_tasks').insert({
          titulo:           card.name,
          descricao:        card.desc || null,
          status:           kanbanStatus,
          responsavel_id:   responsavelId,    // null quando sem mapping — nunca fake
          trello_member_id: firstMemberId,    // persiste o ID do membro para redistribuição futura
          prioridade,
          data,
          origem:           'trello',
          origem_id:        card.id,
          ordem,
          sla_level:        sla.sla_level,
          sla_due_at:       sla.sla_due_at,
          updated_at:       now,
        })
        criados++
      }
    }

    const naoMapeados = Array.from(membrosSemMapping.values())

    // 6. Fechar log com sucesso — armazena aviso de membros sem mapping
    const avisoLog = naoMapeados.length > 0
      ? `Membros sem mapping (${naoMapeados.length}): ${naoMapeados.join(', ')}`
      : null

    await supabase.from('trello_sync_logs').update({
      status:            'sucesso',
      cards_criados:     criados,
      cards_atualizados: atualizados,
      cards_ignorados:   ignorados,
      // Usa erro_detalhes para avisos não-críticos (membros sem mapping)
      erro_detalhes:     avisoLog,
      finished_at:       new Date().toISOString(),
    }).eq('id', logId)

    return {
      success:              true,
      cards_criados:        criados,
      cards_atualizados:    atualizados,
      cards_ignorados:      ignorados,
      sem_responsavel:      semResponsavel,
      membros_nao_mapeados: naoMapeados,
      log_id:               logId,
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await failLog(msg)
    throw err
  }
}
