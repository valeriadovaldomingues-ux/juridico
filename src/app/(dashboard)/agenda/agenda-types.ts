// ─── Shared types & config for the Agenda module ─────────────────────────────

export type Tipo      = 'tarefa' | 'evento' | 'prazo' | 'audiencia'
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
  responsavel?: string
  created_at: string
  processo?: { titulo: string } | null
  cliente?: { nome: string } | null
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
}

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
    prioridade: 'media', processo_id: '', cliente_id: '', responsavel: '',
    ...defaults,
  }
}
