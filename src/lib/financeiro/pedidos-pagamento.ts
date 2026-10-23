import { lerPagamento, type FormaPagamento } from './forma-pagamento'

// Pedidos de pagamento ("a pagar"): a Operação cadastra, o sócio dá o OK e, no OK, vira despesa.

export type StatusPedido = 'aguardando_ok' | 'aprovado' | 'recusado'

export interface PedidoPagamento {
  id: string
  descricao: string
  fornecedor: string | null
  categoria: string
  centro_custo: string | null
  valor: number
  vencimento: string
  observacoes: string | null
  status: StatusPedido
  solicitado_por: string | null
  solicitado_por_nome: string | null
  solicitado_em: string
  decidido_por: string | null
  decidido_por_nome: string | null
  decidido_em: string | null
  motivo_recusa: string | null
  lancamento_id: string | null
  forma_pagamento: FormaPagamento | null
  parcelas_total: number | null
  parcela_atual: number | null
}

export interface DadosPedido {
  descricao: string
  fornecedor: string | null
  categoria: string
  centro_custo: string | null
  valor: number
  vencimento: string
  observacoes: string | null
  forma_pagamento: FormaPagamento | null
  parcelas_total: number | null
  parcela_atual: number | null
}

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** Aceita "1.234,56", "1234.56" ou número; devolve null se inválido ou <= 0. */
export function lerValor(entrada: unknown): number | null {
  if (typeof entrada === 'number') return Number.isFinite(entrada) && entrada > 0 ? Math.round(entrada * 100) / 100 : null
  const s = String(entrada ?? '').trim().replace(/[R$\s]/g, '')
  if (!s) return null
  const normal = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  const n = Number(normal)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

export function normalizarPedido(body: Record<string, unknown> | null): { ok: true; dados: DadosPedido } | { ok: false; erro: string } {
  const descricao = String(body?.descricao ?? '').trim().slice(0, 200)
  const valor = lerValor(body?.valor)
  const vencimento = String(body?.vencimento ?? '')
  if (!descricao) return { ok: false, erro: 'Descreva o que vai ser pago.' }
  if (valor === null) return { ok: false, erro: 'Informe um valor maior que zero.' }
  if (!ISO.test(vencimento) || Number.isNaN(new Date(`${vencimento}T12:00:00Z`).getTime())) return { ok: false, erro: 'Informe a data de vencimento.' }
  const pag = lerPagamento(body)
  if (!pag.ok) return { ok: false, erro: pag.erro }
  const txt = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max) || null
  return {
    ok: true,
    dados: {
      descricao, valor, vencimento,
      fornecedor: txt(body?.fornecedor, 160),
      categoria: txt(body?.categoria, 80) ?? 'Geral',
      centro_custo: txt(body?.centro_custo, 80),
      observacoes: txt(body?.observacoes, 1000),
      ...pag.dados,
    },
  }
}

/** Texto da despesa criada no OK: "Descrição — Fornecedor". */
export function descricaoDaDespesa(p: Pick<DadosPedido, 'descricao' | 'fornecedor'>): string {
  return p.fornecedor ? `${p.descricao} — ${p.fornecedor}` : p.descricao
}
