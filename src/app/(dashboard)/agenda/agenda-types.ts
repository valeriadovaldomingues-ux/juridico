import type { AgendaTimeEntry } from '@/types'

// ─── Shared types & config for the Agenda module ─────────────────────────────

export type Tipo =
  | 'tarefa' | 'evento' | 'prazo' | 'audiencia'
  // ─ acréscimo: lista completa de tipos de atividade ─
  | 'atendimento' | 'auditoria' | 'compromisso_particular' | 'compromisso_privado'
  | 'consultoria' | 'diligencia' | 'eventos_e_cursos' | 'ligacao' | 'outros'
  | 'pericia' | 'prazo_processual' | 'reuniao' | 'sessao_julgamento' | 'solicitar_demanda'
  | 'viagem'
export type Status    = 'pendente' | 'concluido' | 'cancelado'
export type Prioridade = 'baixa' | 'media' | 'alta'
export type ViewMode  = 'lista' | 'dia' | 'semana' | 'mes'

export interface AgendaItem {
  id: string
  titulo: string
  descricao?: string
  tipo: Tipo
  status: Status
  data_inicio: string
  hora_inicio?: string
  data_fim?: string
  hora_fim?: string
  prazo_final?: string
  prioridade: Prioridade
  processo_id?: string
  cliente_id?: string
  opposing_party_name?: string
  responsavel?: string
  created_at: string
  processo?: { titulo: string } | null
  cliente?: { nome: string } | null
  time_entries?: AgendaTimeEntry[]
}

export interface Processo { id: string; titulo: string }
export interface Cliente  { id: string; nome: string }

export interface AgendaForm {
  titulo: string
  descricao: string
  tipo: Tipo
  status: Status
  data_inicio: string
  hora_inicio: string
  data_fim: string
  hora_fim: string
  prazo_final: string
  prioridade: Prioridade
  processo_id: string
  cliente_id: string
  parte_contraria: string
  responsavel: string
}

// ─── Visual config ────────────────────────────────────────────────────────────

export const TIPO_CFG: Record<Tipo, {
  label: string; bg: string; text: string; dot: string; border: string; chip: string
}> = {
  tarefa:    { label: 'Tarefa',    bg: 'bg-slate-100',  text: 'text-slate-600',  dot: 'bg-slate-400',  border: 'border-slate-200', chip: 'bg-slate-100 text-slate-700'   },
  evento:    { label: 'Evento',    bg: 'bg-blue-50',    text: 'text-blue-600',   dot: 'bg-blue-400',   border: 'border-blue-100',  chip: 'bg-blue-100 text-blue-700'     },
  prazo:     { label: 'Prazo',     bg: 'bg-orange-50',  text: 'text-orange-600', dot: 'bg-orange-400', border: 'border-orange-100',chip: 'bg-orange-100 text-orange-700' },
  audiencia: { label: 'Audiência', bg: 'bg-rose-50',    text: 'text-rose-600',   dot: 'bg-rose-400',   border: 'border-rose-100',  chip: 'bg-rose-100 text-rose-700'     },
  // ─ acréscimo: lista completa de tipos de atividade ─
  atendimento:             { label: 'Atendimento',             bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-400', border: 'border-emerald-100', chip: 'bg-emerald-100 text-emerald-700' },
  auditoria:               { label: 'Auditoria',               bg: 'bg-purple-50',  text: 'text-purple-600',  dot: 'bg-purple-400',  border: 'border-purple-100',  chip: 'bg-purple-100 text-purple-700'   },
  compromisso_particular:  { label: 'Compromisso Particular',  bg: 'bg-pink-50',    text: 'text-pink-600',    dot: 'bg-pink-400',    border: 'border-pink-100',    chip: 'bg-pink-100 text-pink-700'       },
  compromisso_privado:     { label: 'Compromisso Privado',     bg: 'bg-fuchsia-50', text: 'text-fuchsia-600', dot: 'bg-fuchsia-400', border: 'border-fuchsia-100', chip: 'bg-fuchsia-100 text-fuchsia-700' },
  consultoria:             { label: 'Consultoria',             bg: 'bg-teal-50',    text: 'text-teal-600',    dot: 'bg-teal-400',    border: 'border-teal-100',    chip: 'bg-teal-100 text-teal-700'       },
  diligencia:              { label: 'Diligência',              bg: 'bg-amber-50',   text: 'text-amber-600',   dot: 'bg-amber-400',   border: 'border-amber-100',   chip: 'bg-amber-100 text-amber-700'     },
  eventos_e_cursos:        { label: 'Eventos e Cursos',        bg: 'bg-sky-50',     text: 'text-sky-600',     dot: 'bg-sky-400',     border: 'border-sky-100',     chip: 'bg-sky-100 text-sky-700'         },
  ligacao:                 { label: 'Ligação',                 bg: 'bg-cyan-50',    text: 'text-cyan-600',    dot: 'bg-cyan-400',    border: 'border-cyan-100',    chip: 'bg-cyan-100 text-cyan-700'       },
  outros:                  { label: 'Outros',                  bg: 'bg-zinc-100',   text: 'text-zinc-600',    dot: 'bg-zinc-400',    border: 'border-zinc-200',    chip: 'bg-zinc-100 text-zinc-700'       },
  pericia:                 { label: 'Perícia',                 bg: 'bg-indigo-50',  text: 'text-indigo-600',  dot: 'bg-indigo-400',  border: 'border-indigo-100',  chip: 'bg-indigo-100 text-indigo-700'   },
  prazo_processual:        { label: 'Prazo Processual',        bg: 'bg-yellow-50',  text: 'text-yellow-700',  dot: 'bg-yellow-400',  border: 'border-yellow-100',  chip: 'bg-yellow-100 text-yellow-700'   },
  reuniao:                 { label: 'Reunião',                 bg: 'bg-lime-50',    text: 'text-lime-700',    dot: 'bg-lime-400',    border: 'border-lime-100',    chip: 'bg-lime-100 text-lime-700'       },
  sessao_julgamento:       { label: 'Sessão de Julgamento',    bg: 'bg-red-50',     text: 'text-red-600',     dot: 'bg-red-400',     border: 'border-red-100',     chip: 'bg-red-100 text-red-700'         },
  solicitar_demanda:       { label: 'Solicitar Demanda',       bg: 'bg-violet-50',  text: 'text-violet-600',  dot: 'bg-violet-400',  border: 'border-violet-100',  chip: 'bg-violet-100 text-violet-700'   },
  viagem:                  { label: 'Viagem',                  bg: 'bg-green-50',   text: 'text-green-600',   dot: 'bg-green-400',   border: 'border-green-100',   chip: 'bg-green-100 text-green-700'     },
}

/** Tipos exibidos no seletor "Novo item" — ordem alfabética, igual ao sistema de referência. */
export const TIPO_OPCOES: Tipo[] = [
  'atendimento', 'audiencia', 'auditoria', 'compromisso_particular', 'compromisso_privado',
  'consultoria', 'diligencia', 'eventos_e_cursos', 'ligacao', 'outros', 'pericia',
  'prazo_processual', 'reuniao', 'sessao_julgamento', 'solicitar_demanda', 'tarefa', 'viagem',
]

/** Tipos que têm horário de início/fim (mostram os campos de data/hora fim). */
export const TIPO_TEM_HORARIO: ReadonlySet<Tipo> = new Set<Tipo>([
  'evento', 'eventos_e_cursos', 'audiencia', 'reuniao', 'sessao_julgamento',
  'diligencia', 'viagem', 'auditoria', 'atendimento', 'consultoria',
])

/** Tipos que têm prazo fatal (mostram o campo de prazo). */
export const TIPO_TEM_PRAZO: ReadonlySet<Tipo> = new Set<Tipo>([
  'prazo', 'prazo_processual', 'audiencia',
])

export const PRIO_CFG: Record<Prioridade, { label: string; bar: string; bg: string; text: string }> = {
  baixa: { label: 'Baixa', bar: 'bg-slate-300', bg: 'bg-slate-100', text: 'text-slate-600' },
  media: { label: 'Média', bar: 'bg-amber-400',  bg: 'bg-amber-50',  text: 'text-amber-700' },
  alta:  { label: 'Alta',  bar: 'bg-red-500',    bg: 'bg-red-50',    text: 'text-red-600'   },
}

export const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

export const DIAS_SEMANA_LONG  = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']
export const DIAS_SEMANA_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function formatDayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${DIAS_SEMANA_SHORT[date.getDay()]}, ${d} ${MESES[m - 1].slice(0, 3)}`
}

export type AlertState = 'overdue' | 'urgent' | 'today' | 'normal'

export function getAlertState(item: AgendaItem, today: string, in3: string): AlertState {
  if (item.status !== 'pendente') return 'normal'
  const ref = item.prazo_final ?? item.data_inicio
  if (ref < today) return 'overdue'
  if (ref === today) return 'today'
  if (ref <= in3)  return 'urgent'
  return 'normal'
}

export function getWeekStart(d: Date): Date {
  const date = new Date(d)
  const day  = date.getDay() // 0 = Sunday
  // Start on Sunday
  date.setDate(date.getDate() - day)
  date.setHours(0, 0, 0, 0)
  return date
}

export function buildMonthCells(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const cells: Date[] = []
  for (let i = 0; i < first.getDay(); i++) {
    cells.push(new Date(year, month, 1 - (first.getDay() - i)))
  }
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d))
  while (cells.length < 42) {
    const prev = cells[cells.length - 1]
    cells.push(new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1))
  }
  return cells
}

export function emptyForm(defaults?: Partial<AgendaForm>): AgendaForm {
  return {
    titulo: '', descricao: '', tipo: 'tarefa', status: 'pendente',
    data_inicio: toLocalISODate(new Date()), hora_inicio: '',
    data_fim: '', hora_fim: '', prazo_final: '',
    prioridade: 'media', processo_id: '', cliente_id: '', parte_contraria: '', responsavel: '',
    ...defaults,
  }
}
