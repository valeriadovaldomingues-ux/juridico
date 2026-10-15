// Pagamento recorrente / parcelado em despesas e receitas extras: um lançamento por mês, a partir do vencimento.
// O valor informado pode ser o de CADA parcela ou o TOTAL (dividido em partes iguais, com a diferença de centavos na última).

import { somarMeses } from './forma-pagamento'

export interface RecorrenciaDados { quantidade: number; valorEhTotal: boolean }

export interface ParcelaRecorrente { vencimento: string; valor: number; parcela_atual: number; parcelas_total: number }

export const RECORRENCIA_MAX = 60

/** Lê `recorrencia: { quantidade, valor_total }` do corpo. Sem recorrência (ou 1 vez só) → dados nulos. */
export function lerRecorrencia(entrada: unknown): { ok: true; dados: RecorrenciaDados | null } | { ok: false; erro: string } {
  if (!entrada || typeof entrada !== 'object') return { ok: true, dados: null }
  const e = entrada as { quantidade?: unknown; valor_total?: unknown }
  const q = Number(e.quantidade)
  if (!Number.isInteger(q)) return { ok: false, erro: 'Recorrência: informe em quantas vezes (número inteiro).' }
  if (q < 1 || q > RECORRENCIA_MAX) return { ok: false, erro: `Recorrência: use de 1 a ${RECORRENCIA_MAX} vezes.` }
  if (q === 1) return { ok: true, dados: null }
  return { ok: true, dados: { quantidade: q, valorEhTotal: e.valor_total === true } }
}

export function serieRecorrente(vencimento: string, valor: number, r: RecorrenciaDados): ParcelaRecorrente[] {
  const centavos = Math.round(valor * 100)
  const base = r.valorEhTotal ? Math.floor(centavos / r.quantidade) : centavos
  const ultima = r.valorEhTotal ? centavos - base * (r.quantidade - 1) : centavos
  return Array.from({ length: r.quantidade }, (_, i) => ({
    vencimento: somarMeses(vencimento, i),
    valor: (i === r.quantidade - 1 ? ultima : base) / 100,
    parcela_atual: i + 1,
    parcelas_total: r.quantidade,
  }))
}
