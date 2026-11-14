import { describe, expect, it } from 'vitest'
import { aliasDoDataJud } from './tribunais'
import { consultarDataJud, dataDoDataJud, interpretarHit } from './consulta'

describe('alias do DataJud pelo número do processo', () => {
  it('trabalho, estadual, federal e superiores', () => {
    expect(aliasDoDataJud('0011753-24.2026.5.03.0069')).toBe('api_publica_trt3')
    expect(aliasDoDataJud('0820700-85.2026.8.19.0021')).toBe('api_publica_tjrj')
    expect(aliasDoDataJud('1001846-71.2026.8.13.0459')).toBe('api_publica_tjmg')
    expect(aliasDoDataJud('0001326-62.2026.5.10.0104')).toBe('api_publica_trt10')
    expect(aliasDoDataJud('0027615-02.2007.4.01.3800')).toBe('api_publica_trf1')
    expect(aliasDoDataJud('0001234-56.2026.8.07.0001')).toBe('api_publica_tjdft')
  })
  it('número fora do padrão ou justiça não coberta → null', () => {
    expect(aliasDoDataJud('7699/2019')).toBeNull()
    expect(aliasDoDataJud('945175671')).toBeNull()
    expect(aliasDoDataJud('0001234-56.2026.6.13.0001')).toBeNull() // eleitoral
    expect(aliasDoDataJud(null)).toBeNull()
  })
})

describe('leitura da resposta do DataJud', () => {
  it('converte datas', () => {
    expect(dataDoDataJud('20261021130330')).toBe('2026-10-21')
    expect(dataDoDataJud('2026-11-04T17:20:00.000Z')).toBe('2026-11-04')
    expect(dataDoDataJud(null)).toBeNull()
  })
  it('ordena movimentos do mais recente para o mais antigo e junta os complementos', () => {
    const p = interpretarHit({
      tribunal: 'TRT3', grau: 'G1', classe: { nome: 'Ação Trabalhista - Rito Sumaríssimo' }, orgaoJulgador: { nome: '1ª Vara do Trabalho de Ouro Preto' },
      dataAjuizamento: '20261021130330', assuntos: [{ nome: 'Rescisão do Contrato de Trabalho' }],
      movimentos: [
        { nome: 'Distribuição', dataHora: '2026-10-21T13:03:00.000Z' },
        { nome: 'Audiência', dataHora: '2026-11-16T08:20:00.000Z', complementosTabelados: [{ nome: 'una' }] },
      ],
    })
    expect(p.ajuizamento).toBe('2026-10-21')
    expect(p.movimentos.map(m => m.nome)).toEqual(['Audiência', 'Distribuição'])
    expect(p.movimentos[0].complemento).toBe('una')
  })
  it('consulta com resposta simulada, sem rede', async () => {
    const fetchFn = (async () => new Response(JSON.stringify({ hits: { hits: [{ _source: { tribunal: 'TRT3', grau: 'G1', movimentos: [] } }] } }), { status: 200 })) as unknown as typeof fetch
    const r = await consultarDataJud('0011753-24.2026.5.03.0069', { fetchFn })
    expect(r.ok && r.processos[0].tribunal).toBe('TRT3')
    const fora = await consultarDataJud('945175671', { fetchFn })
    expect(fora.ok).toBe(false)
  })
})
