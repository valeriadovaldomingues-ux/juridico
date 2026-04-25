// ─────────────────────────────────────────────────────────────────────────────
// src/lib/kanban-sla.ts
//
// SLA enxuto do Kanban — 3 níveis operacionais.
//
// normal  → tudo bem, sem urgência
// atencao → ação esperada em breve
// critico → ação imediata
//
// Puramente funcional. Sem side-effects. Funciona em servidor e cliente.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type SLALevel = 'normal' | 'atencao' | 'critico'

export interface SLAResult {
  sla_level:  SLALevel
  sla_due_at: string | null  // ISO timestamp do prazo, quando disponível
}

export interface SLABadge {
  label:      string   // "Crítico" | "Atenção" | "" (normal não mostra)
  badgeCls:   string   // classes Tailwind do badge
  borderCls:  string   // classe da borda esquerda do card
  show:       boolean  // false para normal
  sortOrder:  number   // 0 crítico, 1 atenção, 2 normal
}

// ─── Cálculo ──────────────────────────────────────────────────────────────────

export interface SLAInput {
  tipo?:       string | null   // 'prazo' | 'audiencia' | 'tarefa' | ...
  origem?:     string | null   // 'agenda' | 'publicacao' | 'comercial' | 'manual' | ...
  data?:       string | null   // yyyy-mm-dd (prazo da tarefa)
  status:      string          // status kanban atual
  prioridade?: string | null   // 'baixa' | 'media' | 'alta' | 'urgente'
}

/**
 * Calcula sla_level e sla_due_at a partir dos campos da tarefa.
 *
 * CRÍTICO:
 *   - tipo prazo ou audiência (independente do prazo)
 *   - prioridade urgente
 *   - due_date no passado ou hoje
 *
 * ATENÇÃO:
 *   - due_date amanhã
 *   - status com_pendencia
 *   - prioridade alta com prazo próximo (≤ 3 dias)
 *   - origem comercial com prazo ≤ 3 dias
 *
 * NORMAL:
 *   - tudo mais
 *   - tarefas concluídas → sempre normal (sem destaque)
 */
export function calculateSimpleSLA(input: SLAInput): SLAResult {
  const sla_due_at = input.data
    ? `${input.data.slice(0, 10)}T23:59:59.000Z`
    : null

  // Concluídas: sem destaque, preservar sla_due_at para histórico
  if (input.status === 'concluido') {
    return { sla_level: 'normal', sla_due_at }
  }

  // Referência de tempo (meia-noite local, comparado com string ISO)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const hojeStr    = hoje.toISOString().slice(0, 10)
  const amanhaStr  = new Date(hoje.getTime() + 86_400_000).toISOString().slice(0, 10)
  const em3DiasStr = new Date(hoje.getTime() + 3 * 86_400_000).toISOString().slice(0, 10)

  const dueStr = input.data?.slice(0, 10) ?? null

  // ── CRÍTICO ──────────────────────────────────────────────────────────────────
  const isTipoCritico  = ['prazo', 'audiencia'].includes(input.tipo ?? '')
  const isUrgente      = input.prioridade === 'urgente'
  const isVencida      = dueStr !== null && dueStr < hojeStr
  const isHoje         = dueStr === hojeStr

  if (isTipoCritico || isUrgente || isVencida || isHoje) {
    return { sla_level: 'critico', sla_due_at }
  }

  // ── ATENÇÃO ───────────────────────────────────────────────────────────────────
  const isAmanha          = dueStr === amanhaStr
  const hasPendencia      = input.status === 'com_pendencia'
  const isAltaComPrazo    = input.prioridade === 'alta' && dueStr !== null && dueStr <= em3DiasStr
  const isComercialProximo = input.origem === 'comercial' && dueStr !== null && dueStr <= em3DiasStr

  if (isAmanha || hasPendencia || isAltaComPrazo || isComercialProximo) {
    return { sla_level: 'atencao', sla_due_at }
  }

  // ── NORMAL ────────────────────────────────────────────────────────────────────
  return { sla_level: 'normal', sla_due_at }
}

// ─── Visual ───────────────────────────────────────────────────────────────────

const SLA_SORT: Record<SLALevel, number> = { critico: 0, atencao: 1, normal: 2 }

/**
 * Retorna aparência do badge SLA para uso no KanbanCard.
 * Recalcula o sla_level na hora para refletir a passagem do tempo.
 */
export function getTaskSLABadge(task: {
  sla_level?:  SLALevel | null
  sla_due_at?: string | null
  tipo?:       string | null
  origem?:     string | null
  data?:       string | null
  status:      string
  prioridade?: string | null
}): SLABadge {
  // Recalcular sempre ao exibir — o prazo pode ter passado desde o último save
  const { sla_level } = calculateSimpleSLA({
    tipo:       task.tipo,
    origem:     task.origem,
    data:       task.data ?? (task.sla_due_at ? task.sla_due_at.slice(0, 10) : null),
    status:     task.status,
    prioridade: task.prioridade,
  })

  const sortOrder = SLA_SORT[sla_level]

  switch (sla_level) {
    case 'critico':
      return {
        label:     'Crítico',
        badgeCls:  'bg-red-50 text-red-600 ring-1 ring-red-300',
        borderCls: '!border-l-red-500',
        show:      task.status !== 'concluido',
        sortOrder,
      }
    case 'atencao':
      return {
        label:     'Atenção',
        badgeCls:  'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-300',
        borderCls: '!border-l-yellow-400',
        show:      task.status !== 'concluido',
        sortOrder,
      }
    default:
      return {
        label:     '',
        badgeCls:  '',
        borderCls: '',
        show:      false,
        sortOrder,
      }
  }
}

// ─── Ordenação ────────────────────────────────────────────────────────────────

/**
 * Ordena tarefas por SLA: crítico → atenção → normal.
 * Desempate: sla_due_at ascendente (prazo mais próximo primeiro).
 */
export function sortBySLA<T extends {
  sla_level?:  SLALevel | null
  sla_due_at?: string | null
  status:      string
}>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const la = SLA_SORT[a.sla_level ?? 'normal']
    const lb = SLA_SORT[b.sla_level ?? 'normal']
    if (la !== lb) return la - lb

    const da = a.sla_due_at ? new Date(a.sla_due_at).getTime() : Infinity
    const db = b.sla_due_at ? new Date(b.sla_due_at).getTime() : Infinity
    return da - db
  })
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

/**
 * Agrupa tarefas por sla_level para indicadores do dashboard.
 * Tarefas concluídas são excluídas dos grupos crítico/atenção.
 */
export function groupBySLALevel<T extends {
  sla_level?: SLALevel | null
  status:     string
}>(tasks: T[]): Record<SLALevel, T[]> {
  const ativas = tasks.filter(t => t.status !== 'concluido')
  return {
    critico: ativas.filter(t => t.sla_level === 'critico'),
    atencao: ativas.filter(t => t.sla_level === 'atencao'),
    normal:  ativas.filter(t => !t.sla_level || t.sla_level === 'normal'),
  }
}
