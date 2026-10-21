import { createClient } from '@/lib/supabase/server'
import { calculateSimpleSLA } from '@/lib/kanban-sla'
import { fetchOpenCards, fetchLists } from './api'
import type { KanbanPrioridade, KanbanStatus } from '@/types/kanban'
import type { TrelloLabel, SyncResult } from '@/types/trello'

/** Client mínimo aceito (compatível com o client SSR de sessão e o de service role). */
type DbClient = { from: (table: string) => any }

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

/** Roda `fn` sobre os itens, `tamanho` por vez em paralelo. */
async function emLotes<T>(itens: T[], tamanho: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < itens.length; i += tamanho) {
    await Promise.all(itens.slice(i, i + tamanho).map(fn))
  }
}

/**
 * Libera sincronizações "em andamento" que ficaram presas: quando a Vercel derruba a execução no meio, o log nunca
 * é fechado e o bloqueio travava todas as sincronizações seguintes (HTTP 409 para sempre). Passou do limite, vira erro.
 */
export async function liberarSincronizacoesTravadas(
  supabase: DbClient,
  integrationId: string,
  limiteMinutos = 10,
): Promise<void> {
  const corte = new Date(Date.now() - limiteMinutos * 60_000).toISOString()
  await supabase
    .from('trello_sync_logs')
    .update({
      status: 'erro',
      erro_detalhes: 'Interrompida (tempo esgotado): liberada automaticamente para a próxima sincronização.',
      finished_at: new Date().toISOString(),
    })
    .eq('integration_id', integrationId)
    .eq('status', 'em_andamento')
    .lt('started_at', corte)
}

// ─── Sync principal ───────────────────────────────────────────────────────────

export async function syncTrelloBoard(
  integrationId: string,
  triggeredBy: string | null,
  client?: DbClient,
): Promise<SyncResult> {
  const supabase = client ?? await createClient()

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

    type ListMappingRow = {
      trello_list_id: string
      kanban_status: string
      profile_id?: string | null
      trello_list_name?: string | null
    }
    type MemberMappingRow = {
      trello_member_id: string
      profile_id: string | null
      trello_full_name?: string | null
      trello_username?: string | null
    }
    const listMappingsTyped   = (listMappings   ?? []) as ListMappingRow[]
    const memberMappingsTyped = (memberMappings ?? []) as MemberMappingRow[]

    // Map: trello_list_id → kanban_status
    const listStatusMap = new Map(
      listMappingsTyped.map(m => [m.trello_list_id, m.kanban_status])
    )

    // Map: trello_list_id → nome da lista, para exibir como coluna própria
    // no quadro do escritório quando a lista não representa uma pessoa
    // (ex.: PRAZOS CÍVEIS, CONCLUÍDOS) — ver getListColumns em kanban.service.ts.
    const listNameMap = new Map<string, string>(
      listMappingsTyped
        .filter((m): m is ListMappingRow & { trello_list_name: string } => !!m.trello_list_name)
        .map(m => [m.trello_list_id, m.trello_list_name])
    )

    // Map: trello_list_id → profile_id, para boards no padrão "lista = pessoa"
    // (a lista já identifica quem é o responsável, sem depender de atribuição
    // de membro do próprio Trello). Tem prioridade sobre o membro do card.
    const listProfileMap = new Map<string, string>(
      listMappingsTyped
        .filter((m): m is ListMappingRow & { profile_id: string } => m.profile_id != null)
        .map(m => [m.trello_list_id, m.profile_id])
    )

    // Map: trello_member_id → profile_id (nunca nulo — ausência = sem mapping)
    // Importante: só inclui membros COM profile_id definido e válido.
    // Membros sem mapping retornam undefined no .get() → responsavel_id = null.
    const memberProfMap = new Map<string, string>(
      memberMappingsTyped
        .filter((m): m is MemberMappingRow & { profile_id: string } => m.profile_id != null)
        .map(m => [m.trello_member_id, m.profile_id])
    )

    // Índice auxiliar para nome legível nos avisos de log
    const memberNameMap = new Map<string, string>(
      memberMappingsTyped.map(m => [
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

    // Posição de cada lista no Trello — usada para ordenar as colunas do quadro igual ao Trello.
    // Falha aqui não derruba a sincronização (só deixa a ordem como estava).
    const posPorLista = new Map<string, number>()
    try {
      const listas = await fetchLists(integration.board_id, integration.api_key, integration.api_token)
      for (const l of listas ?? []) if (typeof l.pos === 'number') posPorLista.set(l.id, l.pos)
      // Mantém a posição também no mapeamento: colunas vazias (ex.: CONCLUÍDOS) seguem a ordem do Trello
      for (const [listId, pos] of posPorLista) {
        await supabase.from('trello_list_mappings').update({ posicao: pos }).eq('integration_id', integrationId).eq('trello_list_id', listId)
      }
    } catch { /* sem posições nesta rodada */ }

    // IDs de todos os cards abertos hoje no Trello (inclui os de listas "ignorar").
    const idsAbertosNoTrello = new Set(cards.map(c => c.id))

    let criados = 0
    let atualizados = 0
    let ignorados = 0
    let semResponsavel = 0

    // Membros do Trello encontrados nos cards mas sem mapping configurado
    const membrosSemMapping = new Map<string, string>()   // trello_id → nome legível

    const now = new Date().toISOString()

    // 5. Processar cada card. As consultas ao banco são o gargalo (2 por card, uma de cada vez passava de
    // 2 min e a Vercel derrubava a execução). Agora: prepara tudo, confere "já existe?" e atualiza em lotes
    // paralelos; só as inclusões (que calculam a ordem no fim da coluna) seguem uma a uma.
    interface TrabalhoCard {
      card: (typeof cards)[number]
      kanbanStatus: KanbanStatus
      responsavelId: string | null
      firstMemberId: string | null
      prioridade: ReturnType<typeof derivePrioridade>
      data: string | null
      listaNome: string | null
      existingId?: string
    }
    const trabalhos: TrabalhoCard[] = []

    for (const card of cards) {
      if (card.closed) { ignorados++; continue }

      const kanbanStatus = listStatusMap.get(card.idList) as KanbanStatus | 'ignorar' | undefined
      if (!kanbanStatus || kanbanStatus === 'ignorar') { ignorados++; continue }

      // Responsável: a lista tem prioridade (padrão "lista = pessoa" — comum
      // quando o board não usa a atribuição de membro do próprio Trello).
      // Sem isso, cai para o membro atribuído no card. Nunca usa ID
      // fallback/placeholder — sem mapping válido em nenhum dos dois, null.
      const firstMemberId = card.idMembers?.[0] ?? null
      let responsavelId: string | null = listProfileMap.get(card.idList) ?? null

      if (!responsavelId && firstMemberId) {
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

      trabalhos.push({
        card, kanbanStatus, responsavelId, firstMemberId,
        prioridade: derivePrioridade(card.labels ?? []),
        data:       card.due ? card.due.slice(0, 10) : null,
        listaNome:  listNameMap.get(card.idList) ?? null,
      })
    }

    // Verificar quais já existem (em lotes paralelos)
    await emLotes(trabalhos, 15, async t => {
      const { data: existing } = await supabase
        .from('kanban_tasks')
        .select('id')
        .eq('origem', 'trello')
        .eq('origem_id', t.card.id)
        .maybeSingle()
      t.existingId = existing?.id
    })

    // Atualizar os existentes (em lotes paralelos)
    await emLotes(trabalhos.filter(t => t.existingId), 15, async t => {
      await supabase
        .from('kanban_tasks')
        .update({
          titulo:           t.card.name,
          descricao:        t.card.desc || null,
          status:           t.kanbanStatus,
          responsavel_id:   t.responsavelId,
          trello_member_id: t.firstMemberId,  // persiste o ID do membro para redistribuição futura
          trello_list_id:   t.card.idList,
          trello_list_nome: t.listaNome,
          trello_list_pos:  posPorLista.get(t.card.idList) ?? null,
          prioridade:       t.prioridade,
          data:             t.data,
          updated_at:       now,
        })
        .eq('id', t.existingId!)
      atualizados++
    })

    // Incluir os novos, um a um (cada um calcula a ordem no final da coluna)
    for (const t of trabalhos.filter(x => !x.existingId)) {
      const { data: maxRow } = await supabase
        .from('kanban_tasks')
        .select('ordem')
        .eq('status', t.kanbanStatus)
        .order('ordem', { ascending: false })
        .limit(1)
        .maybeSingle()
      const ordem = maxRow ? maxRow.ordem + 1 : 0

      const sla = calculateSimpleSLA({
        tipo: 'tarefa', origem: 'trello', data: t.data, status: t.kanbanStatus, prioridade: t.prioridade,
      })

      await supabase.from('kanban_tasks').insert({
        titulo:           t.card.name,
        descricao:        t.card.desc || null,
        status:           t.kanbanStatus,
        responsavel_id:   t.responsavelId,    // null quando sem mapping — nunca fake
        trello_member_id: t.firstMemberId,    // persiste o ID do membro para redistribuição futura
        trello_list_id:   t.card.idList,
        trello_list_nome: t.listaNome,
        trello_list_pos:  posPorLista.get(t.card.idList) ?? null,
        prioridade:       t.prioridade,
        data:             t.data,
        origem:           'trello',
        origem_id:        t.card.id,
        ordem,
        sla_level:        sla.sla_level,
        sla_due_at:       sla.sla_due_at,
        updated_at:       now,
      })
      criados++
    }

    // Cards que existem no sistema mas não estão mais abertos no Trello (foram concluídos,
    // arquivados ou apagados lá) saem do quadro — antes ficavam acumulando. Arquivar é
    // reversível ("Ver arquivadas"). Só roda quando o Trello devolveu cards, para uma
    // resposta vazia/falha nunca esvaziar o quadro.
    let arquivados = 0
    if (cards.length > 0) {
      const { data: existentes } = await supabase
        .from('kanban_tasks')
        .select('id, origem_id')
        .eq('origem', 'trello')
        .eq('arquivado', false)
      const orfaos = idsParaArquivar((existentes ?? []) as { id: string; origem_id: string | null }[], idsAbertosNoTrello)
      for (let i = 0; i < orfaos.length; i += 100) {
        await supabase
          .from('kanban_tasks')
          .update({ arquivado: true, arquivado_em: now, updated_at: now })
          .in('id', orfaos.slice(i, i + 100))
      }
      arquivados = orfaos.length
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
      cards_arquivados:     arquivados,
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

/** IDs (do sistema) dos cards do Trello que não estão mais abertos no Trello. */
export function idsParaArquivar(
  existentes: { id: string; origem_id: string | null }[],
  abertosNoTrello: Set<string>,
): string[] {
  return existentes.filter(t => t.origem_id && !abertosNoTrello.has(t.origem_id)).map(t => t.id)
}
