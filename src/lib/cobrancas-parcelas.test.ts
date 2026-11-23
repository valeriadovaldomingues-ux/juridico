import { describe, expect, it } from 'vitest'
import { montarPlano, parseValorBR, rotuloMes } from './cobrancas-parcelas'

describe('parseValorBR', () => {
  it('entende formatos brasileiros e simples', () => {
    expect(parseValorBR('1500,25')).toBe(1500.25)
    expect(parseValorBR('1.500,25')).toBe(1500.25)
    expect(parseValorBR('R$ 1.500,00')).toBe(1500)
    expect(parseValorBR('1500.5')).toBe(1500.5)
    expect(parseValorBR(' 2000 ')).toBe(2000)
  })
  it('vazio ou inválido → null', () => {
    for (const ruim of ['', '  ', 'abc', '12,3,4', '1.2.3', null, undefined]) expect(parseValorBR(ruim as never), String(ruim)).toBeNull()
  })
})

describe('rotuloMes', () => {
  it('mês/ano em português', () => {
    expect(rotuloMes('2027-03-10')).toBe('mar/2027')
    expect(rotuloMes('2026-12-31')).toBe('dez/2026')
  })
})

describe('montarPlano', () => {
  const base = { vencimentoInicial: '2026-11-10', diaVencimento: 10, incluir13: false }

  it('valor fixo: todas as parcelas iguais, datas mês a mês, total certo', () => {
    const p = montarPlano({ ...base, quantidade: 4, valorFixo: '1.500,00' })
    expect(p.parcelas.map(x => x.vencimento)).toEqual(['2026-11-10', '2026-12-10', '2027-01-10', '2027-02-10'])
    expect(p.parcelas.map(x => x.mes)).toEqual(['nov/2026', 'dez/2026', 'jan/2027', 'fev/2027'])
    expect(p.parcelas.every(x => x.valor === 1500)).toBe(true)
    expect(p.total).toBe(6000)
    expect(p.invalidas).toEqual([])
  })

  it('mês a mês: cada parcela com o seu valor', () => {
    const p = montarPlano({ ...base, quantidade: 3, valoresMensais: ['1000', '1.200,50', '1300'] })
    expect(p.parcelas.map(x => x.valor)).toEqual([1000, 1200.5, 1300])
    expect(p.total).toBe(3500.5)
  })

  it('13º ligado: só dezembro muda; sem valor do 13º informado = em dobro', () => {
    const p = montarPlano({ ...base, quantidade: 3, valoresMensais: ['1000', '1000', '1000'], incluir13: true })
    expect(p.parcelas.map(x => x.valor)).toEqual([1000, 2000, 1000])
    expect(p.parcelas[1]).toMatchObject({ ehDezembro: true, base: 1000, decimoTerceiro: 1000, valor: 2000 })
    expect(p.parcelas[0].decimoTerceiro).toBe(0)
    expect(p.total).toBe(4000)
  })

  it('13º ligado com valor próprio (índice da parcela de dezembro)', () => {
    const p = montarPlano({ ...base, quantidade: 3, valoresMensais: ['1000', '1000', '1000'], incluir13: true, valores13: ['', '600,00', ''] })
    expect(p.parcelas[1].valor).toBe(1600)
    expect(p.parcelas[1].decimoTerceiro).toBe(600)
  })

  it('13º desligado: dezembro é igual aos outros meses (mesmo com valor de 13º digitado)', () => {
    const p = montarPlano({ ...base, quantidade: 3, valorFixo: '1000', incluir13: false, valores13: ['', '600', ''] })
    expect(p.parcelas.map(x => x.valor)).toEqual([1000, 1000, 1000])
  })

  it('vários dezembros: cada um leva o seu 13º', () => {
    const p = montarPlano({ ...base, quantidade: 14, valorFixo: '100', incluir13: true })
    const dezembros = p.parcelas.filter(x => x.ehDezembro)
    expect(dezembros.map(x => x.mes)).toEqual(['dez/2026', 'dez/2027'])
    expect(dezembros.every(x => x.valor === 200)).toBe(true)
    expect(p.total).toBe(14 * 100 + 2 * 100)
  })

  it('parcelas sem valor ou abaixo de R$ 2,50 ficam inválidas e fora do total', () => {
    const p = montarPlano({ ...base, quantidade: 4, valoresMensais: ['1000', '', '2,49', '2,50'] })
    expect(p.invalidas).toEqual([2, 3])
    expect(p.parcelas[1].valor).toBeNull()
    expect(p.parcelas[2].valor).toBeNull()
    expect(p.total).toBe(1002.5)
  })

  it('dia 31 respeita fim de mês (igual ao servidor)', () => {
    const p = montarPlano({ vencimentoInicial: '2027-01-31', diaVencimento: 31, quantidade: 3, valorFixo: '100', incluir13: false })
    expect(p.parcelas.map(x => x.vencimento)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31'])
  })

  it('13º com base inválida em dezembro não inventa valor', () => {
    const p = montarPlano({ ...base, quantidade: 2, valoresMensais: ['1000', ''], incluir13: true })
    expect(p.parcelas[1]).toMatchObject({ valor: null, decimoTerceiro: 0 })
  })
})
