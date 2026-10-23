import { describe, expect, it, vi } from 'vitest'
import { DjenPublicationProvider, gerarHashDJEN, limparHTMLPublicacao } from './provider'
import type { ComunicacaoDJENBruta, ConsultaDJEN } from './types'

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

function consultaOAB(termo = 'MG98185'): ConsultaDJEN {
  return {
    tipo: 'oab',
    termo,
    params: { numeroOab: '98185', ufOab: 'MG' },
  }
}

function itemBruto(overrides: Partial<ComunicacaoDJENBruta> = {}): ComunicacaoDJENBruta {
  return {
    id: 685151465,
    data_disponibilizacao: '2026-08-03',
    siglaTribunal: 'TJMG',
    tipoComunicacao: 'Intimação',
    nomeOrgao: 'TJMG - TERCEIRA VICE-PRESIDÊNCIA',
    texto: 'Intimação de <b>teste</b> para manifestação em 15 dias.',
    numeroprocessocommascara: '3587182-05.2025.8.13.0000',
    link: 'https://www4.tjmg.jus.br/exemplo',
    destinatarios: [{ nome: 'FULANO DE TAL', polo: 'ATIVO' }],
    destinatarioadvogados: [{ nome: 'CRISTIANO PESSOA SOUSA', numero_oab: '88465', uf_oab: 'MG' }],
    ...overrides,
  }
}

describe('limparHTMLPublicacao', () => {
  it('remove tags e decodifica entidades', () => {
    expect(limparHTMLPublicacao('Texto <b>em negrito</b><br/>e &amp; comercial')).toBe(
      'Texto em negrito \ne & comercial',
    )
  })
})

describe('gerarHashDJEN', () => {
  it('usa o identificador oficial quando disponível — estável entre termos diferentes', () => {
    const item = itemBruto()
    const hashPorOAB = gerarHashDJEN(item)
    const hashPorNome = gerarHashDJEN({ ...item }) // mesma comunicação, "encontrada" por outro termo
    expect(hashPorOAB).toBe(hashPorNome)
    expect(hashPorOAB).toMatch(/^djen_/)
  })

  it('gera hashes diferentes para ids diferentes', () => {
    const a = gerarHashDJEN(itemBruto({ id: 1 }))
    const b = gerarHashDJEN(itemBruto({ id: 2 }))
    expect(a).not.toBe(b)
  })

  it('cai para hash por conteúdo quando não há id nem hash oficial', () => {
    const item = itemBruto({ id: undefined, hash: undefined })
    const hash = gerarHashDJEN(item)
    expect(hash).toMatch(/^djen_/)
    // pequenas mudanças de formatação do texto não devem mudar o hash (o texto é limpo antes)
    const hash2 = gerarHashDJEN({ ...item, texto: '  Intimação de <b>teste</b>   para manifestação em 15 dias.  ' })
    expect(hash2).toBe(hash)
  })
})

describe('DjenPublicationProvider.normalizePublication', () => {
  it('normaliza uma comunicação completa', () => {
    const provider = new DjenPublicationProvider()
    const normalizada = provider.normalizePublication({ consulta: consultaOAB(), item: itemBruto() })

    expect(normalizada).not.toBeNull()
    expect(normalizada?.fonte_codigo).toBe('djen')
    expect(normalizada?.id_externo).toBe('685151465')
    expect(normalizada?.tribunal).toBe('TJMG')
    expect(normalizada?.numero_processo).toBe('3587182-05.2025.8.13.0000')
    expect(normalizada?.numero_processo_digits).toBe('35871820520258130000')
    expect(normalizada?.advogados?.[0]).toMatchObject({ nome: 'CRISTIANO PESSOA SOUSA', numero_oab: '88465', uf_oab: 'MG' })
    expect(normalizada?.partes?.[0]).toMatchObject({ nome: 'FULANO DE TAL', polo: 'ATIVO' })
    expect(normalizada?.texto).not.toMatch(/<[^>]+>/)
  })

  it('retorna null quando não há texto', () => {
    const provider = new DjenPublicationProvider()
    const normalizada = provider.normalizePublication({ consulta: consultaOAB(), item: itemBruto({ texto: '' }) })
    expect(normalizada).toBeNull()
  })
})

describe('DjenPublicationProvider.searchPublications', () => {
  it('pagina até esgotar o count e evita repetição de página', async () => {
    const pagina1 = { count: 3, items: [itemBruto({ id: 1 }), itemBruto({ id: 2 })] }
    const pagina2 = { count: 3, items: [itemBruto({ id: 3 })] }
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(jsonResponse(pagina1))
      .mockResolvedValueOnce(jsonResponse(pagina2))

    const provider = new DjenPublicationProvider({ fetchFn, sleep: vi.fn().mockResolvedValue(undefined) })
    const resultado = await provider.searchPublications([consultaOAB()], { inicio: '2026-08-01', fim: '2026-08-04' })

    expect(resultado.encontrados).toHaveLength(3)
    expect(resultado.paginas_consultadas).toBe(2)
    expect(resultado.incompleto).toBe(false)
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('marca incompleto e para quando a mesma página se repete', async () => {
    const paginaRepetida = { count: 10, items: [itemBruto({ id: 1 })] }
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(paginaRepetida))

    const provider = new DjenPublicationProvider({ fetchFn, sleep: vi.fn().mockResolvedValue(undefined) })
    const resultado = await provider.searchPublications([consultaOAB()], { inicio: '2026-08-01', fim: '2026-08-04' })

    expect(resultado.incompleto).toBe(true)
    expect(resultado.encontrados).toHaveLength(1)
  })

  it('não cancela o lote quando uma consulta falha — falha parcial', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, 403))
      .mockResolvedValueOnce(jsonResponse({ count: 1, items: [itemBruto()] }))

    const provider = new DjenPublicationProvider({
      fetchFn,
      sleep: vi.fn().mockResolvedValue(undefined),
      maxTentativas: 1,
    })
    const resultado = await provider.searchPublications(
      [consultaOAB('falha'), consultaOAB('ok')],
      { inicio: '2026-08-01', fim: '2026-08-04' },
    )

    expect(resultado.erros).toHaveLength(1)
    expect(resultado.erros[0].status_http).toBe(403)
    expect(resultado.encontrados).toHaveLength(1)
  })

  it('faz retry com backoff em 429 e volta a funcionar', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(jsonResponse({ count: 1, items: [itemBruto()] }))

    const sleep = vi.fn().mockResolvedValue(undefined)
    const provider = new DjenPublicationProvider({ fetchFn, sleep, maxTentativas: 2 })
    const resultado = await provider.searchPublications([consultaOAB()], { inicio: '2026-08-01', fim: '2026-08-04' })

    expect(resultado.encontrados).toHaveLength(1)
    expect(resultado.erros).toHaveLength(0)
    expect(sleep).toHaveBeenCalled()
  })

  it('trata timeout (AbortError) como falha temporária e não derruba o lote', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    const fetchFn = vi.fn()
      .mockRejectedValueOnce(abortError)
      .mockResolvedValueOnce(jsonResponse({ count: 1, items: [itemBruto()] }))

    const provider = new DjenPublicationProvider({
      fetchFn,
      sleep: vi.fn().mockResolvedValue(undefined),
      maxTentativas: 2,
    })
    const resultado = await provider.searchPublications([consultaOAB()], { inicio: '2026-08-01', fim: '2026-08-04' })

    expect(resultado.encontrados).toHaveLength(1)
  })
})

describe('DjenPublicationProvider.testConnection / getProviderStatus', () => {
  it('classifica bloqueio do WAF (403) corretamente', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, 403))
    const provider = new DjenPublicationProvider({ fetchFn, sleep: vi.fn().mockResolvedValue(undefined) })

    const status = await provider.testConnection()
    expect(status.situacao).toBe('bloqueado')
    expect(status.status_http).toBe(403)
    expect(provider.getProviderStatus()).toEqual(status)
  })

  it('reporta operacional em resposta de sucesso', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ count: 0, items: [] }))
    const provider = new DjenPublicationProvider({ fetchFn })

    const status = await provider.testConnection()
    expect(status.situacao).toBe('operacional')
  })
})

describe('DjenPublicationProvider.fetchPublicationDetails', () => {
  it('busca o detalhe pelo id oficial', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(itemBruto()))
    const provider = new DjenPublicationProvider({ fetchFn })

    const detalhe = await provider.fetchPublicationDetails('685151465')
    expect(detalhe?.id).toBe(685151465)
    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining('/comunicacao/685151465'),
      expect.any(Object),
    )
  })

  it('retorna null para id inválido sem chamar a rede', async () => {
    const fetchFn = vi.fn()
    const provider = new DjenPublicationProvider({ fetchFn })
    const detalhe = await provider.fetchPublicationDetails('abc')
    expect(detalhe).toBeNull()
    expect(fetchFn).not.toHaveBeenCalled()
  })
})
