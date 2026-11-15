// CRM Cris e Val — formatação e leitura de valores (R$ e datas). Puro, usado por UI e API.

/**
 * Lê um valor em reais digitado à brasileira ("1.500,50", "1500,5", "1500.50", "R$ 2.000").
 * Devolve `null` para vazio e `NaN` para texto que não é número.
 */
export function lerValorBR(entrada: string | number | null | undefined): number | null {
  if (entrada === null || entrada === undefined) return null
  if (typeof entrada === 'number') return Number.isFinite(entrada) ? entrada : Number.NaN
  const t = entrada.replace(/R\$/gi, '').replace(/\s/g, '')
  if (t === '') return null
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.'))
  // Só pontos: "1.500" / "1.500.000" = milhar; "1500.50" = decimal.
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ''))
  return Number(t)
}

export function formatarBRL(valor: number | null | undefined, semCentavos = false): string {
  if (valor === null || valor === undefined) return '—'
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    ...(semCentavos ? { maximumFractionDigits: 0 } : {}),
  })
}

/** "2026-11-15" → "15/11/2026" (sem passar por Date, para não escorregar de dia por fuso). */
export function formatarDataISO(iso: string | null | undefined): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—'
}

/** Timestamp ISO → "15/11/2026" na hora local. */
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

/** Texto curto para "há N dias" / "hoje". */
export function textoDias(dias: number): string {
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'há 1 dia'
  return `há ${dias} dias`
}
