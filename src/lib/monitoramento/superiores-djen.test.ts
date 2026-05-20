import { describe, expect, it, vi } from 'vitest'
import { buscarPublicacoesSuperiorDJEN } from './superiores-djen'

describe('monitoramento tribunais superiores DJEN', () => {
  it('consulta tribunal superior na API pública DJEN/CNJ e mapeia origem superior_djen', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: 'success',
        count: 1,
        items: [{
          id: 613533648,
          hash: 'hash-stj',
          data_disponibilizacao: '2026-05-19',
          siglaTribunal: 'STJ',
          tipoComunicacao: 'Intimação',
          nomeOrgao: 'Coordenadoria de Processamento de Feitos',
          texto: '<html><body>Processo 1000000-00.2026.3.00.0000. ADVOGADO TESTE intimado.</body></html>',
          numeroprocessocommascara: '1000000-00.2026.3.00.0000',
        }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const publicacoes = await buscarPublicacoesSuperiorDJEN({
      tribunal: 'STJ',
      nomes: ['ADVOGADO TESTE'],
      data: '2026-05-19',
    })

    expect(String(fetchMock.mock.calls[0][0])).toContain('siglaTribunal=STJ')
    expect(publicacoes).toHaveLength(1)
    expect(publicacoes[0]).toMatchObject({
      tribunal: 'STJ',
      origem: 'superior_djen',
      numero_processo: '1000000-00.2026.3.00.0000',
      termo_encontrado: 'ADVOGADO TESTE',
    })

    vi.unstubAllGlobals()
  })
})
