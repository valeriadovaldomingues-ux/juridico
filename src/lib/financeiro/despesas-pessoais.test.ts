import { describe, expect, it } from 'vitest'
import { lerDespesaPessoal, totaisDespesasPessoais } from './despesas-pessoais'

describe('lerDespesaPessoal', () => {
  const base = { descricao: ' Plano de saúde ', valor: '1250.5', vencimento: '2026-11-20' }

  it('normaliza e aplica padrões', () => {
    const r = lerDespesaPessoal(base)
    expect(r).toEqual({ ok: true, dados: { socio_id: null, descricao: 'Plano de saúde', categoria: 'Geral', valor: 1250.5, vencimento: '2026-11-20', pagamento_em: null, status: 'pendente', observacoes: null } })
  })
  it('recusa descrição vazia, valor inválido, data inválida e status inválido', () => {
    expect(lerDespesaPessoal({ ...base, descricao: '  ' }).ok).toBe(false)
    expect(lerDespesaPessoal({ ...base, valor: 0 }).ok).toBe(false)
    expect(lerDespesaPessoal({ ...base, valor: 'abc' }).ok).toBe(false)
    expect(lerDespesaPessoal({ ...base, vencimento: '20/11/2026' }).ok).toBe(false)
    expect(lerDespesaPessoal({ ...base, status: 'qualquer' }).ok).toBe(false)
    expect(lerDespesaPessoal(null).ok).toBe(false)
  })
  it('só guarda data de pagamento quando está pago', () => {
    const pago = lerDespesaPessoal({ ...base, status: 'pago', pagamento_em: '2026-11-18' })
    expect(pago.ok && pago.dados.pagamento_em).toBe('2026-11-18')
    const pend = lerDespesaPessoal({ ...base, status: 'pendente', pagamento_em: '2026-11-18' })
    expect(pend.ok && pend.dados.pagamento_em).toBe(null)
    expect(lerDespesaPessoal({ ...base, status: 'pago', pagamento_em: 'ontem' }).ok).toBe(false)
  })
})

describe('totaisDespesasPessoais', () => {
  it('separa pago, a vencer e vencido; ignora cancelado', () => {
    const t = totaisDespesasPessoais([
      { valor: 100, status: 'pago', vencimento: '2026-11-01' },
      { valor: 50.5, status: 'pendente', vencimento: '2026-11-30' },
      { valor: 20, status: 'pendente', vencimento: '2026-11-10' },
      { valor: 999, status: 'cancelado', vencimento: '2026-11-10' },
    ], '2026-11-18')
    expect(t).toEqual({ pago: 100, pendente: 50.5, vencido: 20, total: 170.5 })
  })
})
