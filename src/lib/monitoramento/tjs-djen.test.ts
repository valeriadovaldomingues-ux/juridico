import { describe, expect, it, vi } from 'vitest'
import { buscarPublicacoesTJDJEN } from './tjs-djen'

describe('monitoramento TJs DJEN', () => {
  it('consulta TJ validado na API pública DJEN/CNJ e mapeia origem tj_djen', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: 'success',
        count: 1,
        items: [{
          id: 612317883,
          hash: 'hash-tjac',
          data_disponibilizacao: '2026-05-19',
          siglaTribunal: 'TJAC',
          tipoComunicacao: 'Intimação',
          nomeOrgao: '1ª Vara Cível da Comarca de Rio Branco',
          texto: '<html><body>Processo 0700000-00.2026.8.01.0001. ADVOGADO TESTE intimado.</body></html>',
          numeroprocessocommascara: '0700000-00.2026.8.01.0001',
        }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const publicacoes = await buscarPublicacoesTJDJEN({
      tribunal: 'TJAC',
      nomes: ['ADVOGADO TESTE'],
      data: '2026-05-19',
    })

    expect(String(fetchMock.mock.calls[0][0])).toContain('siglaTribunal=TJAC')
    expect(publicacoes).toHaveLength(1)
    expect(publicacoes[0]).toMatchObject({
      tribunal: 'TJAC',
      origem: 'tj_djen',
      numero_processo: '0700000-00.2026.8.01.0001',
      termo_encontrado: 'ADVOGADO TESTE',
    })

    vi.unstubAllGlobals()
  })

  it('mantém erro HTTP explícito para tribunal sob rate limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(buscarPublicacoesTJDJEN({
      tribunal: 'TJRO',
      nomes: ['ADVOGADO TESTE'],
      data: '2026-05-19',
    })).rejects.toThrow('HTTP 429')

    vi.unstubAllGlobals()
  })
})
