import { describe, expect, it } from 'vitest'
import { lerPagamento, rotuloPagamento, serieDeParcelas, somarMeses } from './forma-pagamento'

describe('lerPagamento', () => {
  it('sem forma: tudo nulo', () => {
    expect(lerPagamento({})).toEqual({ ok: true, dados: { forma_pagamento: null, parcelas_total: null, parcela_atual: null } })
  })
  it('débito, débito em conta, boleto e pix ignoram parcelas', () => {
    for (const f of ['debito', 'debito_conta', 'boleto', 'pix']) {
      expect(lerPagamento({ forma_pagamento: f, parcelas_total: 5, parcela_atual: 2 })).toEqual({ ok: true, dados: { forma_pagamento: f, parcelas_total: null, parcela_atual: null } })
    }
  })
  it('crédito parcelado: guarda total e a parcela do mês', () => {
    expect(lerPagamento({ forma_pagamento: 'credito', parcelas_total: '10', parcela_atual: '3' })).toEqual({ ok: true, dados: { forma_pagamento: 'credito', parcelas_total: 10, parcela_atual: 3 } })
  })
  it('crédito sem informar a parcela assume a 1ª; sem total, sem parcelas', () => {
    expect(lerPagamento({ forma_pagamento: 'credito', parcelas_total: 6 })).toMatchObject({ ok: true, dados: { parcela_atual: 1 } })
    expect(lerPagamento({ forma_pagamento: 'credito' })).toMatchObject({ ok: true, dados: { parcelas_total: null, parcela_atual: null } })
  })
  it('recusa parcela maior que o total, total fora do limite, forma inválida e decimais', () => {
    expect(lerPagamento({ forma_pagamento: 'credito', parcelas_total: 3, parcela_atual: 4 })).toMatchObject({ ok: false })
    expect(lerPagamento({ forma_pagamento: 'credito', parcelas_total: 0 })).toMatchObject({ ok: false })
    expect(lerPagamento({ forma_pagamento: 'credito', parcelas_total: 61 })).toMatchObject({ ok: false })
    expect(lerPagamento({ forma_pagamento: 'cheque' })).toMatchObject({ ok: false })
    expect(lerPagamento({ forma_pagamento: 'credito', parcelas_total: 2.5 })).toMatchObject({ ok: false })
    expect(lerPagamento({ forma_pagamento: 'credito', parcela_atual: 2 })).toMatchObject({ ok: false })
  })
})

describe('rotuloPagamento', () => {
  it('mostra forma e parcela', () => {
    expect(rotuloPagamento({ forma_pagamento: 'credito', parcelas_total: 10, parcela_atual: 3 })).toBe('Crédito 3/10')
    expect(rotuloPagamento({ forma_pagamento: 'debito', parcelas_total: null, parcela_atual: null })).toBe('Débito')
    expect(rotuloPagamento({ forma_pagamento: 'credito', parcelas_total: 1, parcela_atual: 1 })).toBe('Crédito')
    expect(rotuloPagamento({})).toBeNull()
  })
})

describe('somarMeses', () => {
  it('mantém o dia e ajusta fim de mês', () => {
    expect(somarMeses('2026-11-15', 1)).toBe('2026-12-15')
    expect(somarMeses('2026-12-15', 1)).toBe('2027-01-15')
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28')
    expect(somarMeses('2028-01-31', 1)).toBe('2028-02-29')
    expect(somarMeses('2026-10-31', 4)).toBe('2027-02-28')
    expect(somarMeses('2026-03-10', 0)).toBe('2026-03-10')
  })
})

describe('serieDeParcelas', () => {
  const cred = (total: number, atual: number) => ({ forma_pagamento: 'credito' as const, parcelas_total: total, parcela_atual: atual })

  it('crédito 3/10 lança da 3ª à 10ª, um mês de diferença', () => {
    const s = serieDeParcelas('2026-11-15', cred(10, 3), true)
    expect(s).toHaveLength(8)
    expect(s[0]).toEqual({ vencimento: '2026-11-15', parcela_atual: 3 })
    expect(s[1]).toEqual({ vencimento: '2026-12-15', parcela_atual: 4 })
    expect(s[7]).toEqual({ vencimento: '2027-06-15', parcela_atual: 10 })
  })
  it('1/12 lança as 12', () => {
    expect(serieDeParcelas('2026-11-05', cred(12, 1), true)).toHaveLength(12)
  })
  it('sem marcar "lançar as seguintes", última parcela, débito ou sem parcelas: só o próprio', () => {
    expect(serieDeParcelas('2026-11-15', cred(10, 3), false)).toEqual([{ vencimento: '2026-11-15', parcela_atual: 3 }])
    expect(serieDeParcelas('2026-11-15', cred(10, 10), true)).toHaveLength(1)
    expect(serieDeParcelas('2026-11-15', { forma_pagamento: 'debito', parcelas_total: null, parcela_atual: null }, true)).toHaveLength(1)
    expect(serieDeParcelas('2026-11-15', { forma_pagamento: null, parcelas_total: null, parcela_atual: null }, true)).toHaveLength(1)
  })
})
