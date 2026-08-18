import { describe, expect, it } from 'vitest'
import { montarConsultasDJEN, urlConsultaDJEN } from './consultas'

const PERIODO = { inicio: '2026-08-01', fim: '2026-08-04' }

describe('montarConsultasDJEN', () => {
  it('gera uma consulta por OAB distinta, cobrindo todos os tribunais de uma vez (sem siglaTribunal)', () => {
    const consultas = montarConsultasDJEN({
      advogados: [
        { id: 'a1', nome_completo: 'FULANO', oab_numero: '98185', oab_uf: 'MG' },
      ],
      periodo: PERIODO,
    })

    expect(consultas).toHaveLength(1)
    expect(consultas[0]).toMatchObject({
      tipo: 'oab',
      termo: 'MG98185',
      params: { numeroOab: '98185', ufOab: 'MG' },
    })
    expect(consultas[0].params.siglaTribunal).toBeUndefined()
  })

  it('ignora advogados inativos', () => {
    const consultas = montarConsultasDJEN({
      advogados: [
        { id: 'a1', nome_completo: 'FULANO', oab_numero: '98185', oab_uf: 'MG', ativo: false },
      ],
      periodo: PERIODO,
    })
    expect(consultas).toHaveLength(0)
  })

  it('deduplica a mesma OAB em formatos diferentes entre dois advogados cadastrados', () => {
    const consultas = montarConsultasDJEN({
      advogados: [
        { id: 'a1', nome_completo: 'FULANO', oab_numero: '098185', oab_uf: 'MG' },
        { id: 'a2', nome_completo: 'FULANO DUPLICADO', oab_numero: '98185', oab_uf: 'mg' },
      ],
      periodo: PERIODO,
    })
    expect(consultas).toHaveLength(1)
  })

  it('gera uma consulta por tribunal de interesse quando informado', () => {
    const consultas = montarConsultasDJEN({
      advogados: [
        { id: 'a1', nome_completo: 'FULANO', oab_numero: '98185', oab_uf: 'MG', tribunais_interesse: ['TJMG', 'TRT3'] },
      ],
      periodo: PERIODO,
    })
    expect(consultas).toHaveLength(2)
    expect(consultas.map(c => c.params.siglaTribunal)).toEqual(['TJMG', 'TRT3'])
  })

  it('inclui consultas por número de processo válido (CNJ) e ignora inválido', () => {
    const consultas = montarConsultasDJEN({
      advogados: [],
      processos: ['3587182-05.2025.8.13.0000', '123'],
      periodo: PERIODO,
    })
    expect(consultas).toHaveLength(1)
    expect(consultas[0]).toMatchObject({ tipo: 'processo', params: { numeroProcesso: '35871820520258130000' } })
  })

  it('respeita o teto de consultas por execução', () => {
    const advogados = Array.from({ length: 50 }, (_, i) => ({
      id: `a${i}`,
      nome_completo: `ADV ${i}`,
      oab_numero: String(100000 + i),
      oab_uf: 'MG',
    }))
    const consultas = montarConsultasDJEN({ advogados, periodo: PERIODO })
    expect(consultas.length).toBeLessThanOrEqual(40)
  })
})

describe('urlConsultaDJEN', () => {
  it('monta a URL com página e parâmetros da consulta', () => {
    const url = urlConsultaDJEN(
      { tipo: 'oab', termo: 'MG98185', params: { numeroOab: '98185', ufOab: 'MG' } },
      2,
    )
    expect(url).toContain('pagina=2')
    expect(url).toContain('numeroOab=98185')
    expect(url).toContain('ufOab=MG')
  })
})
