// Lançamento de horas (timesheet): valida o que a pessoa digitou e monta os horários/duração.
// Horário de Brasília (-03:00, sem horário de verão desde 2019).

export interface EntradaHoras {
  descricao?: unknown
  data?: unknown            // AAAA-MM-DD
  modo?: unknown            // 'periodo' | 'duracao'
  inicio?: unknown          // HH:MM
  fim?: unknown             // HH:MM
  horas?: unknown
  minutos?: unknown
}

export interface TempoLancado {
  inicio_em: string
  fim_em: string | null
  duracao_manual_minutos: number | null
  usa_duracao_manual: boolean
  minutos: number
}

const DATA = /^\d{4}-\d{2}-\d{2}$/
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

export function lerTempo(e: EntradaHoras): { ok: true; tempo: TempoLancado } | { ok: false; erro: string } {
  const data = typeof e.data === 'string' ? e.data : ''
  if (!DATA.test(data) || Number.isNaN(Date.parse(`${data}T12:00:00Z`))) return { ok: false, erro: 'Informe a data (AAAA-MM-DD).' }

  if (e.modo === 'duracao') {
    const h = Number(e.horas ?? 0)
    const m = Number(e.minutos ?? 0)
    if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || m > 59) return { ok: false, erro: 'Duração inválida: use horas e minutos inteiros (minutos de 0 a 59).' }
    const total = h * 60 + m
    if (total <= 0) return { ok: false, erro: 'A duração precisa ser maior que zero.' }
    if (total > 24 * 60) return { ok: false, erro: 'A duração passa de 24 horas.' }
    // Sem horário: marca ao meio-dia para o lançamento cair sempre no dia certo.
    return { ok: true, tempo: { inicio_em: `${data}T12:00:00-03:00`, fim_em: null, duracao_manual_minutos: total, usa_duracao_manual: true, minutos: total } }
  }

  const inicio = typeof e.inicio === 'string' ? e.inicio : ''
  const fim = typeof e.fim === 'string' ? e.fim : ''
  if (!HORA.test(inicio) || !HORA.test(fim)) return { ok: false, erro: 'Informe a hora de início e a de fim (HH:MM).' }
  const minutos = (Number(fim.slice(0, 2)) * 60 + Number(fim.slice(3))) - (Number(inicio.slice(0, 2)) * 60 + Number(inicio.slice(3)))
  if (minutos <= 0) return { ok: false, erro: 'A hora de fim precisa ser depois da de início.' }
  return { ok: true, tempo: { inicio_em: `${data}T${inicio}:00-03:00`, fim_em: `${data}T${fim}:00-03:00`, duracao_manual_minutos: null, usa_duracao_manual: false, minutos } }
}
