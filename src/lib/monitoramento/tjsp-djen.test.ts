import { describe, expect, it, vi } from 'vitest'
import { buscarPublicacoesTJSPDJEN } from './tjsp-djen'

describe('monitoramento TJSP DJEN', () => {
  it('consulta TJSP na API pública DJEN/CNJ e mapeia origem tjsp_djen', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: 'success',
        count: 1,
        items: [{
          id: 612317882,
          hash: 'hash-tjsp',
          data_disponibilizacao: '2026-05-19',
          siglaTribunal: 'TJSP',
          tipoComunicacao: 'Edital',
          nomeOrgao: '1ª Vara Cível da Comarca de Votorantim',
          texto: '<html><body>Processo 1000000-00.2026.8.26.0100. ADVOGADO TESTE intimado.</body></html>',
          numeroprocessocommascara: '1000000-00.2026.8.26.0100',
        }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const publicacoes = await buscarPublicacoesTJSPDJEN({
      nomes: ['ADVOGADO TESTE'],
      data: '2026-05-19',
    })

    expect(String(fetchMock.mock.calls[0][0])).toContain('siglaTribunal=TJSP')
    expect(publicacoes).toHaveLength(1)
    expect(publicacoes[0]).toMatchObject({
      tribunal: 'TJSP',
      origem: 'tjsp_djen',
      numero_processo: '1000000-00.2026.8.26.0100',
      termo_encontrado: 'ADVOGADO TESTE',
    })

    vi.unstubAllGlobals()
  })
})
