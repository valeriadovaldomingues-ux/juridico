// ─── Trello API ───────────────────────────────────────────────────────────────

export interface TrelloBoard {
  id: string
  name: string
}

export interface TrelloList {
  id: string
  name: string
  closed: boolean
}

export interface TrelloMember {
  id: string
  username: string
  fullName: string
}

export interface TrelloLabel {
  id: string
  color: string | null
  name: string
}

export interface TrelloCard {
  id: string
  name: string
  desc: string
  idList: string
  idMembers: string[]
  due: string | null
  labels: TrelloLabel[]
  closed: boolean
}

// ─── Banco de dados ───────────────────────────────────────────────────────────

export interface TrelloIntegration {
  id: string
  board_id: string
  api_key: string
  api_token: string
  board_name: string | null
  ativo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TrelloListMapping {
  id: string
  integration_id: string
  trello_list_id: string
  trello_list_name: string | null
  kanban_status: 'a_fazer' | 'fazendo' | 'com_pendencia' | 'concluido' | 'ignorar'
}

export interface TrelloMemberMapping {
  id: string
  integration_id: string
  trello_member_id: string
  trello_username: string | null
  trello_full_name: string | null
  profile_id: string | null
}

export interface TrelloSyncLog {
  id: string
  integration_id: string
  triggered_by: string | null
  status: 'sucesso' | 'erro' | 'em_andamento'
  cards_criados: number
  cards_atualizados: number
  cards_ignorados: number
  erro_detalhes: string | null
  started_at: string
  finished_at: string | null
  triggered_by_profile?: { nome: string } | null
}

// ─── Resultado do sync ────────────────────────────────────────────────────────

export interface SyncResult {
  success: boolean
  cards_criados: number
  cards_atualizados: number
  cards_ignorados: number
  /** Tarefas importadas sem responsável (membro Trello sem mapping) */
  sem_responsavel: number
  /** Nomes dos membros Trello que não têm mapping configurado */
  membros_nao_mapeados: string[]
  log_id: string
}
