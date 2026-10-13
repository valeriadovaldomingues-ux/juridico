// Forma de pagamento de uma despesa: como foi paga e, no crédito/boleto parcelado, quantas parcelas e qual é a do mês.

export type FormaPagamento = 'credito' | 'debito' | 'debito_conta' | 'boleto' | 'pix' | 'transferencia' | 'dinheiro'

export const FORMAS_PAGAMENTO: { id: FormaPagamento; label: string }[] = [
  { id: 'credito',       label: 'Crédito' },
  { id: 'debito',        label: 'Débito' },
  { id: 'debito_conta',  label: 'Débito em conta' },
  { id: 'boleto',        label: 'Boleto' },
  { id: 'pix',           label: 'Pix' },
  { id: 'transferencia', label: 'Transferência' },
  { id: 'dinheiro',      label: 'Dinheiro' },
]

const ROTULO = new Map(FORMAS_PAGAMENTO.map(f => [f.id, f.label]))

/** Só o crédito tem parcelas (a fatura cai mês a mês). */
export const FORMAS_COM_PARCELAS: FormaPagamento[] = ['credito']

export interface PagamentoDados {
  forma_pagamento: FormaPagamento | null
  parcelas_total: number | null
  parcela_atual: number | null
}

/** Lê e valida os 3 campos. Parcela só vale com total; parcela atual não passa do total; só só o crédito parcela. */
export function lerPagamento(entrada: { forma_pagamento?: unknown; parcelas_total?: unknown; parcela_atual?: unknown } | null | undefined):
  { ok: true; dados: PagamentoDados } | { ok: false; erro: string } {
  const bruta = String(entrada?.forma_pagamento ?? '').trim()
  if (bruta && !ROTULO.has(bruta as FormaPagamento)) return { ok: false, erro: 'Forma de pagamento inválida.' }
  const forma = (bruta || null) as FormaPagamento | null

  const num = (v: unknown) => {
    if (v === null || v === undefined || String(v).trim() === '') return null
    const n = Number(v)
    return Number.isInteger(n) ? n : NaN
  }
  const total = num(entrada?.parcelas_total)
  const atual = num(entrada?.parcela_atual)
  if (Number.isNaN(total) || Number.isNaN(atual)) return { ok: false, erro: 'Parcelas: use números inteiros.' }

  if (!forma || !FORMAS_COM_PARCELAS.includes(forma)) {
    return { ok: true, dados: { forma_pagamento: forma, parcelas_total: null, parcela_atual: null } }
  }
  if (total === null) {
    if (atual !== null) return { ok: false, erro: 'Informe o total de parcelas.' }
    return { ok: true, dados: { forma_pagamento: forma, parcelas_total: null, parcela_atual: null } }
  }
  if (total < 1 || total > 60) return { ok: false, erro: 'O total de parcelas deve ficar entre 1 e 60.' }
  const parcela = atual ?? 1
  if (parcela < 1 || parcela > total) return { ok: false, erro: 'A parcela do mês não pode ser maior que o total de parcelas.' }
  return { ok: true, dados: { forma_pagamento: forma, parcelas_total: total, parcela_atual: parcela } }
}

/** "Crédito 3/10", "Débito", "Pix"… ou null se não informado. */
export function rotuloPagamento(l: Partial<PagamentoDados> | null | undefined): string | null {
  if (!l?.forma_pagamento) return null
  const base = ROTULO.get(l.forma_pagamento) ?? l.forma_pagamento
  return l.parcelas_total && l.parcelas_total > 1 && l.parcela_atual ? `${base} ${l.parcela_atual}/${l.parcelas_total}` : base
}

/** Soma meses a uma data ISO (YYYY-MM-DD) mantendo o dia; se o mês não tem esse dia, usa o último (31/01 + 1 mês = 28/02). */
export function somarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const total = (m - 1) + meses
  const ano = a + Math.floor(total / 12)
  const mes = ((total % 12) + 12) % 12
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(Math.min(d, ultimoDia)).padStart(2, '0')}`
}

export interface ParcelaDaSerie { vencimento: string; parcela_atual: number }

/**
 * Parcelas a lançar: da parcela informada até a última, uma por mês a partir do vencimento dado.
 * Ex.: crédito 3/10 vencendo 15/11 → parcelas 3 (15/11), 4 (15/12) … 10 (15/06). Sem parcelamento: só o próprio lançamento.
 */
export function serieDeParcelas(vencimento: string, p: PagamentoDados, lancarSeguintes: boolean): ParcelaDaSerie[] {
  if (p.forma_pagamento !== 'credito' || !p.parcelas_total || !p.parcela_atual || !lancarSeguintes || p.parcelas_total === p.parcela_atual) {
    return [{ vencimento, parcela_atual: p.parcela_atual ?? 1 }]
  }
  const lista: ParcelaDaSerie[] = []
  for (let n = p.parcela_atual; n <= p.parcelas_total; n++) {
    lista.push({ vencimento: somarMeses(vencimento, n - p.parcela_atual), parcela_atual: n })
  }
  return lista
}
