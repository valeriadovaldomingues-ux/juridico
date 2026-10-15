import { describe, expect, it } from 'vitest'
import { lerRecorrencia, serieRecorrente } from './recorrencia'

describe('lerRecorrencia', () => {
  it('sem dados ou 1 vez: não é recorrente', () => {
    expect(lerRecorrencia(undefined)).toEqual({ ok: true, dados: null })
    expect(lerRecorrencia({ quantidade: 1 })).toEqual({ ok: true, dados: null })
  })
  it('valida a quantidade', () => {
    expect(lerRecorrencia({ quantidade: 'x' }).ok).toBe(false)
    expect(lerRecorrencia({ quantidade: 0 }).ok).toBe(false)
    expect(lerRecorrencia({ quantidade: 61 }).ok).toBe(false)
    expect(lerRecorrencia({ quantidade: 6, valor_total: true })).toEqual({ ok: true, dados: { quantidade: 6, valorEhTotal: true } })
  })
})

describe('serieRecorrente', () => {
  it('valor de cada parcela: repete o valor, um por mês', () => {
    const s = serieRecorrente('2026-11-10', 500, { quantidade: 3, valorEhTotal: false })
    expect(s.map(p => p.vencimento)).toEqual(['2026-11-10', '2026-12-10', '2027-01-10'])
    expect(s.map(p => p.valor)).toEqual([500, 500, 500])
    expect(s.map(p => `${p.parcela_atual}/${p.parcelas_total}`)).toEqual(['1/3', '2/3', '3/3'])
  })
  it('valor total: divide e acerta os centavos na última', () => {
    const s = serieRecorrente('2026-01-31', 100, { quantidade: 3, valorEhTotal: true })
    expect(s.map(p => p.valor)).toEqual([33.33, 33.33, 33.34])
    expect(s.reduce((a, p) => a + Math.round(p.valor * 100), 0)).toBe(10000)
    expect(s.map(p => p.vencimento)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })
})
