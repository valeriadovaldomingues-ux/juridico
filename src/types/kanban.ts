export type KanbanStatus    = 'a_fazer' | 'fazendo' | 'com_pendencia' | 'concluido'
export type KanbanPrioridade = 'baixa' | 'media' | 'alta' | 'urgente'
export type KanbanOrigem    = 'manual' | 'publicacao' | 'agenda' | 'processo' | 'trello'
export type KanbanTipo      = 'tarefa' | 'prazo' | 'audiencia' | 'reuniao' | 'outro'

// SLA
export type SLALevel = 'normal' | 'atencao' | 'critico'

export interface KanbanTask {
  id: string
  titulo: string
  descricao?: string | null
  tipo?: KanbanTipo | null
  status: KanbanStatus
  prioridade: KanbanPrioridade
  responsavel_id?: string | null
  processo_id?: string | null
  numero_processo?: string | null
  partes_resumidas?: string | null
  area_juridica?: string | null
  pendencia_motivo?: string | null
  publicacao_id?: string | null
  origem: KanbanOrigem
  origem_id?: string | null       // ID externo (ex: Trello card ID)
  trello_member_id?: string | null // Trello member ID do responsável (armazenado no sync)
  escritorio_id?: string | null
  agenda_item_id?: string | null  // FK para agenda_items (quando origem = 'agenda')
  data?: string | null            // prazo (date ISO)
  ordem: number
  // SLA
  sla_level?:  SLALevel | null
  sla_due_at?: string | null
  concluido_em?: string | null
  created_at: string
  updated_at: string
  // Joins
  responsavel?: { id: string; nome: string; cor_kanban?: string | null } | null
  processo?: { id: string; titulo: string; numero_processo?: string | null } | null
}

export interface KanbanProfile {
  id: string
  nome: string
  cor_kanban?: string | null
  role: string
}

export const STATUS_LABELS: Record<KanbanStatus, string> = {
  a_fazer:       'A Fazer',
  fazendo:       'Fazendo',
  com_pendencia: 'Com Pendência',
  concluido:     'Concluído',
}

export const STATUS_ORDER: KanbanStatus[] = ['a_fazer', 'fazendo', 'com_pendencia', 'concluido']

export const PRIORIDADE_CFG: Record<KanbanPrioridade, {
  label: string; bg: string; text: string; dot: string
}> = {
  baixa:   { label: 'Baixa',   bg: 'bg-slate-100',   text: 'text-slate-500',   dot: 'bg-slate-300'  },
  media:   { label: 'Média',   bg: 'bg-blue-50',     text: 'text-blue-600',    dot: 'bg-blue-400'   },
  alta:    { label: 'Alta',    bg: 'bg-orange-50',   text: 'text-orange-600',  dot: 'bg-orange-400' },
  urgente: { label: 'Urgente', bg: 'bg-red-50',      text: 'text-red-600',     dot: 'bg-red-500'    },
}

// Paleta elegante para usuários sem cor definida
export const USER_COLORS = [
  '#145A5B', '#2563eb', '#7c3aed', '#db2777',
  '#d97706', '#0891b2', '#16a34a', '#9333ea',
]

export function getUserColor(profile: KanbanProfile, index: number): string {
  return profile.cor_kanban ?? USER_COLORS[index % USER_COLORS.length]
}

// ── Histórico ─────────────────────────────────────────────────────────────────

export type KanbanHistoricoAcao =
  | 'criacao'
  | 'status'
  | 'responsavel'
  | 'status_responsavel'
  | 'edicao'

export interface KanbanHistoricoEntry {
  id: string
  task_id: string
  usuario_id: string | null
  acao: KanbanHistoricoAcao | null
  de_status: KanbanStatus | null
  para_status: KanbanStatus | null
  de_responsavel_id: string | null
  para_responsavel_id: string | null
  created_at: string
  // Joins
  usuario?: { id: string; nome: string; cor_kanban?: string | null } | null
  de_responsavel?: { id: string; nome: string } | null
  para_responsavel?: { id: string; nome: string } | null
}
