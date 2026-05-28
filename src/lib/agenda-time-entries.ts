import type { AgendaTimeEntry, AgendaTimeEntryBillingStatus } from '@/types'

export interface AgendaTimeEntryDraft {
  agenda_item_id: string
  cliente_id?: string | null
  processo_id?: string | null
  descricao_atividade?: string
  observacoes?: string | null
  inicio_em: string
  fim_em?: string | null
  duracao_manual_minutos?: number | null
  usa_duracao_manual?: boolean
  cobravel?: boolean
  valor_hora?: number | null
  status_cobranca?: AgendaTimeEntryBillingStatus
}

export interface AgendaTimeEntrySummary {
  entryCount: number
  totalMinutes: number
  billableMinutes: number
  nonBillableMinutes: number
  estimatedValue: number | null
}

const MONEY_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatCurrencyBRL(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return MONEY_FORMATTER.format(Number(value))
}

export function formatDurationMinutes(totalMinutes: number | null | undefined) {
  if (totalMinutes === null || totalMinutes === undefined || !Number.isFinite(Number(totalMinutes))) {
    return '—'
  }

  const minutes = Math.max(0, Math.round(Number(totalMinutes)))
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

export function toDatetimeLocalValue(iso: string | null | undefined) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const pad = (n: number) => String(n).padStart(2, '0')
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function fromDatetimeLocalValue(value: string) {
  if (!value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function calculateEffectiveMinutes(entry: Pick<AgendaTimeEntry, 'duracao_calculada_minutos' | 'duracao_manual_minutos' | 'usa_duracao_manual'>) {
  if (entry.usa_duracao_manual && entry.duracao_manual_minutos !== null && entry.duracao_manual_minutos !== undefined) {
    return Math.max(0, Math.round(entry.duracao_manual_minutos))
  }

  if (entry.duracao_calculada_minutos === null || entry.duracao_calculada_minutos === undefined) {
    return null
  }

  return Math.max(0, Math.round(entry.duracao_calculada_minutos))
}

export function calculateDurationMinutes(inicioEm: string, fimEm: string | null | undefined) {
  if (!fimEm) return null
  const start = new Date(inicioEm)
  const end = new Date(fimEm)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null

  const diff = end.getTime() - start.getTime()
  if (diff < 0) return null
  return Math.max(0, Math.round(diff / 60000))
}

export function calculateEstimatedValue(
  durationMinutes: number | null,
  valorHora: number | null | undefined,
  cobravel: boolean,
  statusCobranca: AgendaTimeEntryBillingStatus,
) {
  if (!cobravel || statusCobranca === 'nao_faturavel') return null
  if (durationMinutes === null || durationMinutes === undefined) return null
  if (valorHora === null || valorHora === undefined || Number.isNaN(Number(valorHora))) return null

  const total = (Number(durationMinutes) / 60) * Number(valorHora)
  return Math.round(total * 100) / 100
}

export function buildAgendaTimeEntrySummary(entries: AgendaTimeEntry[]): AgendaTimeEntrySummary {
  const totals = entries.reduce<AgendaTimeEntrySummary>(
    (acc, entry) => {
      const effectiveMinutes = calculateEffectiveMinutes(entry)
      const isBillable = entry.cobravel && entry.status_cobranca !== 'nao_faturavel'

      acc.entryCount += 1
      if (effectiveMinutes !== null) {
        acc.totalMinutes += effectiveMinutes
        if (isBillable) acc.billableMinutes += effectiveMinutes
        else acc.nonBillableMinutes += effectiveMinutes
      }

      const value = calculateEstimatedValue(
        effectiveMinutes,
        entry.valor_hora,
        entry.cobravel,
        entry.status_cobranca,
      )

      if (value !== null) {
        acc.estimatedValue = (acc.estimatedValue ?? 0) + value
      }

      return acc
    },
    {
      entryCount: 0,
      totalMinutes: 0,
      billableMinutes: 0,
      nonBillableMinutes: 0,
      estimatedValue: null,
    },
  )

  return totals
}

export function createAgendaTimeEntryPayload(input: {
  agenda_item_id?: string
  cliente_id?: string | null
  processo_id?: string | null
  descricao_atividade?: string
  observacoes?: string | null
  inicio_em: string
  fim_em?: string | null
  duracao_manual_minutos?: number | null
  usa_duracao_manual?: boolean
  cobravel?: boolean
  valor_hora?: number | null
  status_cobranca?: AgendaTimeEntryBillingStatus
}) {
  const inicioEm = input.inicio_em
  const fimEm = input.fim_em ?? null
  const usaDuracaoManual = Boolean(input.usa_duracao_manual)
  const duracaoManual = input.duracao_manual_minutos ?? null
  const cobravel = input.cobravel ?? true
  const statusCobranca = cobravel
    ? (input.status_cobranca ?? 'pendente')
    : 'nao_faturavel'

  const duracaoCalculada = calculateDurationMinutes(inicioEm, fimEm)
  const effectiveMinutes = calculateEffectiveMinutes({
    duracao_calculada_minutos: duracaoCalculada,
    duracao_manual_minutos: duracaoManual,
    usa_duracao_manual: usaDuracaoManual,
  })

  return {
    agenda_item_id: input.agenda_item_id,
    cliente_id: input.cliente_id ?? null,
    processo_id: input.processo_id ?? null,
    descricao_atividade: input.descricao_atividade?.trim() ?? '',
    observacoes: input.observacoes?.trim() || null,
    inicio_em: inicioEm,
    fim_em: fimEm,
    duracao_calculada_minutos: duracaoCalculada,
    duracao_manual_minutos: duracaoManual,
    usa_duracao_manual: usaDuracaoManual,
    cobravel,
    valor_hora: input.valor_hora ?? null,
    status_cobranca: statusCobranca,
    valor_total: calculateEstimatedValue(
      effectiveMinutes,
      input.valor_hora ?? null,
      cobravel,
      statusCobranca,
    ),
  }
}
