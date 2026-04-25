// ─── Regras ───────────────────────────────────────────────────────────────────

export type TriggerType =
  | 'lead_parado'
  | 'proposta_sem_resposta'
  | 'cliente_sem_contato'
  | 'aniversario_cliente'
  | 'aniversario_equipe'
  | 'tarefa_vencida'
  | 'tarefa_vencendo_hoje'
  | 'usuario_sem_movimentacao'
  | 'usuario_sem_timesheet'
  | 'compromisso_proximo'
  | 'processo_sem_movimentacao'

export type ActionType =
  | 'criar_tarefa'
  | 'notificar'
  | 'criar_tarefa_e_notificar'

export interface TriggerConditions {
  days?:        number    // dias de espera
  hora_limite?: string    // ex: "18:00" para timesheet
  [key: string]: unknown
}

export interface ActionPayload {
  task_priority?:     'baixa' | 'media' | 'alta' | 'urgente'
  notify_responsavel?: boolean
  notify_roles?:       string[]   // roles que recebem notificação
  cooldown_hours?:     number     // horas mínimas entre execuções para o mesmo contexto
  [key: string]:       unknown
}

export interface Automation {
  id:                 string
  name:               string
  description:        string | null
  trigger_type:       TriggerType
  trigger_conditions: TriggerConditions
  action_type:        ActionType
  action_payload:     ActionPayload
  is_active:          boolean
  created_by:         string | null
  created_at:         string
  updated_at:         string
  // computed (from joins/aggregation)
  last_run_at?:       string | null
  total_runs?:        number
}

// ─── Histórico ────────────────────────────────────────────────────────────────

export interface AutomationRun {
  id:                       string
  automation_id:            string | null
  rule_type:                string
  entity_type:              string
  entity_id:                string
  action_type:              string
  status:                   'ok' | 'skipped' | 'error'
  message:                  string | null
  created_task_id:          string | null
  created_notification_id?: string | null
  executed_at:              string
  automation?:              { name: string } | null
}

// ─── Notificações ─────────────────────────────────────────────────────────────

export type NotificationType = 'info' | 'warning' | 'critical' | 'success'

export interface Notification {
  id:         string
  user_id:    string
  title:      string
  message:    string
  type:       NotificationType
  is_read:    boolean
  link:       string | null
  created_at: string
}

// ─── Modelos de mensagem ──────────────────────────────────────────────────────

export interface MessageTemplate {
  id:            string
  name:          string
  template_type: string
  content:       string
  is_active:     boolean
  created_at:    string
  updated_at:    string
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export interface EngineResult {
  started_at:     string
  finished_at:    string
  automations_ran: number
  total_created:  number
  total_skipped:  number
  total_errors:   number
  details:        RuleResult[]
}

export interface RuleResult {
  automation_id:   string
  automation_name: string
  trigger_type:    string
  entities_found:  number
  actions_taken:   number
  skipped:         number
  error?:          string
}

// ─── Labels e ícones ─────────────────────────────────────────────────────────

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  lead_parado:              'Lead parado',
  proposta_sem_resposta:    'Proposta sem resposta',
  cliente_sem_contato:      'Cliente sem contato',
  aniversario_cliente:      'Aniversário de cliente',
  aniversario_equipe:       'Aniversário da equipe',
  tarefa_vencida:           'Tarefa vencida',
  tarefa_vencendo_hoje:     'Tarefa vencendo hoje',
  usuario_sem_movimentacao: 'Usuário sem movimentação',
  usuario_sem_timesheet:    'Usuário sem timesheet',
  compromisso_proximo:      'Compromisso próximo',
  processo_sem_movimentacao:'Processo sem movimentação',
}

export const ACTION_LABELS: Record<ActionType, string> = {
  criar_tarefa:           'Criar tarefa',
  notificar:              'Enviar notificação',
  criar_tarefa_e_notificar: 'Criar tarefa + notificar',
}

export const TRIGGER_CATEGORIES: Record<string, TriggerType[]> = {
  Comercial: ['lead_parado', 'proposta_sem_resposta'],
  Clientes:  ['cliente_sem_contato', 'aniversario_cliente'],
  Equipe:    ['aniversario_equipe', 'usuario_sem_movimentacao', 'usuario_sem_timesheet'],
  Tarefas:   ['tarefa_vencida', 'tarefa_vencendo_hoje'],
  Processos: ['processo_sem_movimentacao', 'compromisso_proximo'],
}
