import { describe, expect, it, vi } from 'vitest'
import { buscarPublicacoesTRT3DJEN, mapearComunicacaoDJEN } from './trt3-djen'

describe('monitoramento TRT3 DJEN', () => {
  const comunicacao = {
    id: 1,
    hash: 'hash-publico',
    data_disponibilizacao: '2026-05-19',
    siglaTribunal: 'TRT3',
    tipoComunicacao: 'Intimação',
    nomeOrgao: 'Vara do Trabalho de Belo Horizonte',
    numero_processo: '00100000020265030001',
    numeroprocessocommascara: '0010000-00.2026.5.03.0001',
    texto: '<html><body>Processo 0010000-00.2026.5.03.0001. ADVOGADO TESTE fica intimado para manifestação.</body></html>',
  }

  it('mapeia comunicação pública do CNJ para publicação TRT3 DJEN', () => {
    const pub = mapearComunicacaoDJEN(comunicacao, 'ADVOGADO TESTE')

    expect(pub).toMatchObject({
      id: 'hash-publico',
      tribunal: 'TRT3',
      origem: 'trt3_djen',
      data_publicacao: '2026-05-19',
      numero_processo: '0010000-00.2026.5.03.0001',
      termo_encontrado: 'ADVOGADO TESTE',
    })
    expect(pub?.texto_publicacao).toContain('fica intimado')
  })

  it('filtra comunicações injetadas por nome, OAB, processo e escritório', async () => {
    const publicacoes = await buscarPublicacoesTRT3DJEN({
      nomes: ['ADVOGADO TESTE'],
      processos: ['0010000-00.2026.5.03.0001'],
      oabs: ['MG123456'],
      comunicacoes: [comunicacao],
    })

    expect(publicacoes).toHaveLength(1)
    expect(publicacoes[0].origem).toBe('trt3_djen')
  })

  it('ignora comunicações de outros tribunais', async () => {
    const publicacoes = await buscarPublicacoesTRT3DJEN({
      nomes: ['ADVOGADO TESTE'],
      comunicacoes: [{ ...comunicacao, siglaTribunal: 'TRT1' }],
    })

    expect(publicacoes).toEqual([])
  })

  it('consulta a API pública do CNJ por OAB e data quando não há comunicações injetadas', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: 'success',
        count: 1,
        items: [comunicacao],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const publicacoes = await buscarPublicacoesTRT3DJEN({
      nomes: [],
      processos: [],
      oabs: ['MG123456'],
      data: '2026-05-19',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://comunicaapi.pje.jus.br/api/v1/comunicacao?'),
      expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/json' }) }),
    )
    expect(String(fetchMock.mock.calls[0][0])).toContain('siglaTribunal=TRT3')
    expect(String(fetchMock.mock.calls[0][0])).toContain('numeroOab=123456')
    expect(String(fetchMock.mock.calls[0][0])).toContain('ufOab=MG')
    expect(publicacoes).toHaveLength(1)

    vi.unstubAllGlobals()
  })
})
