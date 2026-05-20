import { describe, expect, it, vi } from 'vitest'
import { buscarPublicacoesTRFDJEN } from './trfs-djen'

describe('monitoramento TRFs DJEN', () => {
  it('consulta TRF validado na API pública DJEN/CNJ e mapeia origem trf_djen', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: 'success',
        count: 1,
        items: [{
          id: 613518973,
          hash: 'hash-trf1',
          data_disponibilizacao: '2026-05-19',
          siglaTribunal: 'TRF1',
          tipoComunicacao: 'Intimação',
          nomeOrgao: '9ª Vara Federal de Juizado Especial Cível da SJMT',
          texto: '<html><body>Processo 1000000-00.2026.4.01.0000. ADVOGADO TESTE intimado.</body></html>',
          numeroprocessocommascara: '1000000-00.2026.4.01.0000',
        }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const publicacoes = await buscarPublicacoesTRFDJEN({
      tribunal: 'TRF1',
      nomes: ['ADVOGADO TESTE'],
      data: '2026-05-19',
    })

    expect(String(fetchMock.mock.calls[0][0])).toContain('siglaTribunal=TRF1')
    expect(publicacoes).toHaveLength(1)
    expect(publicacoes[0]).toMatchObject({
      tribunal: 'TRF1',
      origem: 'trf_djen',
      numero_processo: '1000000-00.2026.4.01.0000',
      termo_encontrado: 'ADVOGADO TESTE',
    })

    vi.unstubAllGlobals()
  })
})
