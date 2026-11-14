// Datas AAAA-MM-DD sem depender do fuso do servidor (a Vercel roda em UTC).

export function hojeSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora)
}

/** Soma (ou subtrai) dias a uma data AAAA-MM-DD. */
export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const data = new Date(Date.UTC(a, m - 1, d + dias))
  return data.toISOString().slice(0, 10)
}

/** Data (AAAA-MM-DD, fuso de São Paulo) de um timestamp ISO. */
export function dataDeTimestamp(timestamp: string): string | null {
  const t = new Date(timestamp)
  return Number.isNaN(t.getTime()) ? null : hojeSaoPaulo(t)
}
