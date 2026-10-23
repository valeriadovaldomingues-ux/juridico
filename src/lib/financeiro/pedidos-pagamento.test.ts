import { describe, expect, it } from 'vitest'
import { descricaoDaDespesa, lerValor, normalizarPedido } from './pedidos-pagamento'

describe('lerValor', () => {
  it('aceita formato brasileiro e americano', () => {
    expect(lerValor('1.234,56')).toBe(1234.56)
    expect(lerValor('R$ 59,90')).toBe(59.9)
    expect(lerValor('1234.5')).toBe(1234.5)
    expect(lerValor(80)).toBe(80)
  })
  it('recusa vazio, zero, negativo e lixo', () => {
    for (const v of ['', null, undefined, '0', '-5', 'abc', 0]) expect(lerValor(v)).toBeNull()
  })
})

describe('normalizarPedido', () => {
  const base = { descricao: ' Aluguel da sala ', valor: '2.500,00', vencimento: '2026-11-05', fornecedor: 'Imobiliária X' }

  it('limpa os campos e preenche padrões', () => {
    const r = normalizarPedido(base)
    expect(r).toEqual({ ok: true, dados: { descricao: 'Aluguel da sala', valor: 2500, vencimento: '2026-11-05', fornecedor: 'Imobiliária X', categoria: 'Geral', centro_custo: null, observacoes: null, forma_pagamento: null, parcelas_total: null, parcela_atual: null } })
  })
  it('exige descrição, valor e data', () => {
    expect(normalizarPedido({ ...base, descricao: '' })).toMatchObject({ ok: false })
    expect(normalizarPedido({ ...base, valor: '0' })).toMatchObject({ ok: false })
    expect(normalizarPedido({ ...base, vencimento: '05/11/2026' })).toMatchObject({ ok: false })
    expect(normalizarPedido(null)).toMatchObject({ ok: false })
  })
  it('crédito parcelado: guarda forma, total e parcela; parcela maior que o total é recusada', () => {
    expect(normalizarPedido({ ...base, forma_pagamento: 'credito', parcelas_total: 10, parcela_atual: 3 })).toMatchObject({ ok: true, dados: { forma_pagamento: 'credito', parcelas_total: 10, parcela_atual: 3 } })
    expect(normalizarPedido({ ...base, forma_pagamento: 'credito', parcelas_total: 3, parcela_atual: 5 })).toMatchObject({ ok: false })
  })
  it('descrição da despesa junta o fornecedor', () => {
    expect(descricaoDaDespesa({ descricao: 'Aluguel', fornecedor: 'Imob X' })).toBe('Aluguel — Imob X')
    expect(descricaoDaDespesa({ descricao: 'Aluguel', fornecedor: null })).toBe('Aluguel')
  })
})
