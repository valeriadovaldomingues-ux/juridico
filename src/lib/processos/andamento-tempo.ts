// Tempo gasto lançado junto com o andamento do processo. Quem faz informa:
//  - início e fim (a duração sai da diferença), ou
//  - só a duração (horas e minutos).
// O resultado alimenta agenda_time_entries (relatório de horas por cliente).

export interface TempoEntrada {
  inicio_em?: string | null
  fim_em?: string | null
  duracao_minutos?: number | null
  cobravel?: boolean
}

export interface TempoNormalizado {
  inicio_em: string
  fim_em: string | null
  duracao_manual_minutos: number | null
  usa_duracao_manual: boolean
  minutos: number
  cobravel: boolean
}

const MAX_MINUTOS = 24 * 60

export function normalizarTempo(
  entrada: TempoEntrada | null | undefined,
  dataAndamentoIso: string,
): { ok: true; tempo: TempoNormalizado } | { ok: false; erro: string } | null {
  if (!entrada) return null
  const temInicio = !!entrada.inicio_em
  const temFim = !!entrada.fim_em
  const temDuracao = entrada.duracao_minutos !== null && entrada.duracao_minutos !== undefined
  if (!temInicio && !temFim && !temDuracao) return null // bloco de tempo vazio = sem tempo
  const cobravel = entrada.cobravel !== false

  if (temInicio && temFim) {
    const ini = new Date(entrada.inicio_em as string)
    const fim = new Date(entrada.fim_em as string)
    if (Number.isNaN(ini.getTime()) || Number.isNaN(fim.getTime())) return { ok: false, erro: 'Início/fim do tempo inválido.' }
    const minutos = Math.round((fim.getTime() - ini.getTime()) / 60000)
    if (minutos <= 0) return { ok: false, erro: 'O fim do tempo precisa ser depois do início.' }
    if (minutos > MAX_MINUTOS) return { ok: false, erro: 'O tempo lançado passa de 24 horas — confira início e fim.' }
    return { ok: true, tempo: { inicio_em: ini.toISOString(), fim_em: fim.toISOString(), duracao_manual_minutos: null, usa_duracao_manual: false, minutos, cobravel } }
  }

  if (temDuracao) {
    const minutos = Math.round(Number(entrada.duracao_minutos))
    if (!Number.isFinite(minutos) || minutos <= 0) return { ok: false, erro: 'Informe a duração em horas e minutos.' }
    if (minutos > MAX_MINUTOS) return { ok: false, erro: 'O tempo lançado passa de 24 horas.' }
    const base = new Date(entrada.inicio_em ?? dataAndamentoIso)
    if (Number.isNaN(base.getTime())) return { ok: false, erro: 'Data do tempo inválida.' }
    return { ok: true, tempo: { inicio_em: base.toISOString(), fim_em: null, duracao_manual_minutos: minutos, usa_duracao_manual: true, minutos, cobravel } }
  }

  return { ok: false, erro: 'Informe início e fim, ou a duração do tempo gasto.' }
}

/** Data (YYYY-MM-DD) e hora (HH:MM) no horário de Brasília. */
export function dataHoraBrasilia(iso: string): { data: string; hora: string } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const g = (t: string) => partes.find(p => p.type === t)?.value ?? '00'
  return { data: `${g('year')}-${g('month')}-${g('day')}`, hora: `${g('hour')}:${g('minute')}` }
}
