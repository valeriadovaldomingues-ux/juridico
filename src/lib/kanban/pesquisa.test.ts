import { describe, expect, it } from 'vitest'
import { cartaoEDoProcesso, diasSemMovimento, movimentacaoMaisRecente } from './pesquisa'

describe('diasSemMovimento', () => {
  it('conta os dias inteiros até hoje', () => {
    expect(diasSemMovimento('2026-11-10', '2026-11-17')).toBe(7)
    expect(diasSemMovimento('2026-11-17', '2026-11-17')).toBe(0)
    expect(diasSemMovimento('2026-11-10T15:00:00Z', '2026-11-17')).toBe(7)
  })
  it('sem data ou data inválida = null; futura = 0', () => {
    expect(diasSemMovimento(null, '2026-11-17')).toBeNull()
    expect(diasSemMovimento('xx', '2026-11-17')).toBeNull()
    expect(diasSemMovimento('2026-12-01', '2026-11-17')).toBe(0)
  })
})

describe('movimentacaoMaisRecente', () => {
  const hoje = '2026-11-17'
  it('escolhe a mais recente entre andamento e publicação', () => {
    expect(movimentacaoMaisRecente({ data: '2026-10-01T12:00:00Z', titulo: 'Juntada' }, { data: '2026-11-05', titulo: 'Intimação' }, hoje))
      .toEqual({ data: '2026-11-05', fonte: 'publicacao', titulo: 'Intimação' })
    expect(movimentacaoMaisRecente({ data: '2026-11-10', titulo: 'Despacho' }, { data: '2026-11-05', titulo: 'Intimação' }, hoje))
      .toEqual({ data: '2026-11-10', fonte: 'andamento', titulo: 'Despacho' })
  })
  it('ignora datas futuras e devolve null quando não há nada', () => {
    expect(movimentacaoMaisRecente({ data: '2026-12-25', titulo: 'Audiência marcada' }, null, hoje)).toBeNull()
    expect(movimentacaoMaisRecente(null, null, hoje)).toBeNull()
  })
})

describe('cartaoEDoProcesso', () => {
  const p = { id: 'p1', numero: '5030014-35.2019.8.13.0079' }
  it('reconhece por vínculo, por número gravado e pelo número escrito no título (cartão do Trello)', () => {
    expect(cartaoEDoProcesso({ processoId: 'p1', numeroProcesso: null, titulo: 'x' }, p)).toBe(true)
    expect(cartaoEDoProcesso({ processoId: null, numeroProcesso: p.numero, titulo: 'x' }, p)).toBe(true)
    expect(cartaoEDoProcesso({ processoId: null, numeroProcesso: null, titulo: '5030014-35.2019.8.13.0079 - THIAGO X EMCON - INTIMAÇÃO' }, p)).toBe(true)
    expect(cartaoEDoProcesso({ processoId: null, numeroProcesso: null, titulo: 'ACHADO PELO INFORMADOR - 50300143520198130079 - PUBLICAÇÃO' }, p)).toBe(true)
  })
  it('não confunde com outro processo', () => {
    expect(cartaoEDoProcesso({ processoId: 'p2', numeroProcesso: '0000001-00.2020.8.13.0001', titulo: 'Outro' }, p)).toBe(false)
    expect(cartaoEDoProcesso({ processoId: null, numeroProcesso: null, titulo: 'Sem número' }, { id: 'p1', numero: null })).toBe(false)
  })
})
