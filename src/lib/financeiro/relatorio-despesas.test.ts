import { describe, expect, it } from 'vitest'
import { anosComDespesa, csvDoRelatorio, dataDoLancamento, montarRelatorioDespesas, percentual, type LancamentoRelatorio } from './relatorio-despesas'

const l = (p: Partial<LancamentoRelatorio>): LancamentoRelatorio => ({
  id: Math.random().toString(36).slice(2), descricao: 'x', categoria: 'ALUGUEL', conta_contabil: '341', valor: 100,
  vencimento: '2026-01-20', pagamento_em: '2026-01-20', status: 'pago', ...p,
})

describe('montarRelatorioDespesas', () => {
  const dados = [
    l({ valor: 9115.83 }),
    l({ valor: 936, descricao: 'garagens' }),
    l({ conta_contabil: '331', categoria: 'SALÁRIOS E ORDENADOS', valor: 96854.75, vencimento: '2026-01-15', pagamento_em: '2026-01-15' }),
    l({ conta_contabil: '341', valor: 9115.83, vencimento: '2026-02-21', pagamento_em: '2026-02-21' }),
    l({ conta_contabil: '341', valor: 500, status: 'cancelado' }),
    l({ conta_contabil: '341', valor: 777, vencimento: '2025-12-20', pagamento_em: '2025-12-20' }),
  ]

  it('soma por conta e mês, ignora cancelado e outros anos', () => {
    const r = montarRelatorioDespesas(dados, 2026)
    const aluguel = r.linhas.find(x => x.codigo === '341')!
    expect(aluguel.meses[0]).toBe(10051.83)
    expect(aluguel.meses[1]).toBe(9115.83)
    expect(aluguel.total).toBe(19167.66)
    expect(aluguel.itens[0]).toHaveLength(2)
  })

  it('totais por mês e do ano; contas do contador aparecem na ordem dele, mesmo sem movimento', () => {
    const r = montarRelatorioDespesas(dados, 2026)
    expect(r.linhas[0].codigo).toBe('331')
    expect(r.linhas.map(x => x.codigo).slice(0, 4)).toEqual(['331', '358', '336', '337'])
    expect(r.totaisMes[0]).toBe(106906.58)
    expect(r.totalAno).toBe(116022.41)
    expect(r.linhas.find(x => x.codigo === '337')!.total).toBe(0)
  })

  it('"só pagas" tira o que ainda está a pagar', () => {
    const base = [l({ valor: 100 }), l({ valor: 50, status: 'pendente', pagamento_em: null, vencimento: '2026-03-10' })]
    expect(montarRelatorioDespesas(base, 2026).totalAno).toBe(150)
    expect(montarRelatorioDespesas(base, 2026, { apenasPagas: true }).totalAno).toBe(100)
  })

  it('despesa lançada à mão sem conta contábil vai para uma linha própria, depois das contas do contador', () => {
    const r = montarRelatorioDespesas([l({ conta_contabil: null, categoria: 'Café', valor: 30 })], 2026)
    const ultima = r.linhas[r.linhas.length - 1]
    expect(ultima.codigo).toBeNull()
    expect(ultima.nome).toBe('CAFÉ')
    expect(ultima.total).toBe(30)
  })

  it('mês vem da data do pagamento, e do vencimento quando ainda não foi pago', () => {
    expect(dataDoLancamento({ pagamento_em: '2026-04-02', vencimento: '2026-03-30' })).toBe('2026-04-02')
    expect(dataDoLancamento({ pagamento_em: null, vencimento: '2026-03-30' })).toBe('2026-03-30')
  })
})

describe('apoio', () => {
  it('percentual e anos', () => {
    expect(percentual(25, 100)).toBe(0.25)
    expect(percentual(5, 0)).toBe(0)
    expect(anosComDespesa([l({ pagamento_em: '2025-05-01' }), l({})], 2026)).toEqual([2026, 2025])
  })

  it('CSV usa ; e vírgula decimal, com cabeçalho e linha de totais', () => {
    const csv = csvDoRelatorio(montarRelatorioDespesas([l({ valor: 1234.5 })], 2026))
    const linhas = csv.split('\r\n')
    expect(linhas[0].startsWith('CÓDIGO;CONTA;JANEIRO;FEVEREIRO')).toBe(true)
    expect(linhas.find(x => x.startsWith('341;ALUGUEL;1234,50'))).toBeTruthy()
    expect(linhas[linhas.length - 1].startsWith(';TOTAIS;1234,50')).toBe(true)
  })
})
