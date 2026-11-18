// Despesas pessoais dos sócios: tabela própria (despesas_pessoais_socios), só sócio enxerga.
// Ficam fora dos totais e relatórios de despesas do escritório de propósito.

export const STATUS_DESPESA_PESSOAL = ['pendente', 'pago', 'cancelado'] as const
export type StatusDespesaPessoal = (typeof STATUS_DESPESA_PESSOAL)[number]

export interface DespesaPessoal {
  id: string
  socio_id: string | null
  descricao: string
  categoria: string
  valor: number
  vencimento: string          // AAAA-MM-DD
  pagamento_em: string | null
  status: StatusDespesaPessoal
  observacoes: string | null
}

export interface DespesaPessoalDados {
  socio_id: string | null
  descricao: string
  categoria: string
  valor: number
  vencimento: string
  pagamento_em: string | null
  status: StatusDespesaPessoal
  observacoes: string | null
}

const dataOk = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T12:00:00Z`).getTime())
const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** Valida e normaliza o corpo recebido pela API. */
export function lerDespesaPessoal(body: unknown): { ok: true; dados: DespesaPessoalDados } | { ok: false; erro: string } {
  const b = (body ?? {}) as Record<string, unknown>
  const descricao = texto(b.descricao)
  if (!descricao) return { ok: false, erro: 'Informe a descrição.' }
  const valor = Number(b.valor)
  if (!Number.isFinite(valor) || valor <= 0) return { ok: false, erro: 'Informe um valor maior que zero.' }
  if (!dataOk(b.vencimento)) return { ok: false, erro: 'Informe o vencimento.' }
  const status = (b.status ?? 'pendente') as StatusDespesaPessoal
  if (!STATUS_DESPESA_PESSOAL.includes(status)) return { ok: false, erro: 'Status inválido.' }
  const pagamento = b.pagamento_em ? b.pagamento_em : null
  if (pagamento !== null && !dataOk(pagamento)) return { ok: false, erro: 'Data de pagamento inválida.' }
  return {
    ok: true,
    dados: {
      socio_id: texto(b.socio_id) || null,
      descricao,
      categoria: texto(b.categoria) || 'Geral',
      valor: Math.round(valor * 100) / 100,
      vencimento: b.vencimento as string,
      pagamento_em: status === 'pago' ? (pagamento as string | null) : null,
      status,
      observacoes: texto(b.observacoes) || null,
    },
  }
}

/** Totais por situação (cancelado não conta). Vencido = pendente com vencimento antes de hoje. */
export function totaisDespesasPessoais(itens: Pick<DespesaPessoal, 'valor' | 'status' | 'vencimento'>[], hojeISO: string) {
  let pago = 0, pendente = 0, vencido = 0
  for (const d of itens) {
    if (d.status === 'cancelado') continue
    if (d.status === 'pago') pago += d.valor
    else if (d.vencimento < hojeISO) vencido += d.valor
    else pendente += d.valor
  }
  const r = (n: number) => Math.round(n * 100) / 100
  return { pago: r(pago), pendente: r(pendente), vencido: r(vencido), total: r(pago + pendente + vencido) }
}
