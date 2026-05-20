import { describe, expect, it, vi } from 'vitest'
import { buscarPublicacoesTRT3DEJT, extrairTextoPDFBasico, montarTermosOAB } from './trt3-dejt'

describe('monitoramento TRT3 DEJT', () => {
  it('monta variações seguras de OAB para busca no caderno', () => {
    expect(montarTermosOAB(['MG123456'])).toEqual([
      'MG123456',
      'MG 123456',
      '123456/MG',
      'OAB/MG 123456',
      'OAB MG123456',
      'OAB MG 123456',
    ])
  })

  it('extrai texto básico de PDF com operador Tj sem depender de biblioteca externa', () => {
    const pdf = Buffer.from('<< /Length 20 >>\nstream\n(Bom dia TRT3) Tj\nendstream', 'latin1')

    expect(extrairTextoPDFBasico(pdf)).toContain('Bom dia TRT3')
  })

  it('filtra publicação real por nome monitorado em texto extraído do DEJT', async () => {
    const pdf = Buffer.from([
      '<< /Length 200 >>',
      'stream',
      '(Caderno Judiciário do Tribunal Regional do Trabalho da 3ª Região. Data da disponibilização: Sexta-feira, 15 de Maio de 2026. Processo 0010000-00.2026.5.03.0001 Intimação de ADVOGADO TESTE para manifestação.) Tj',
      'endstream',
    ].join('\n'), 'latin1')

    const publicacoes = await buscarPublicacoesTRT3DEJT({
      nomes: ['ADVOGADO TESTE'],
      processos: [],
      oabs: [],
      pdfBuffer: pdf,
    })

    expect(publicacoes).toHaveLength(1)
    expect(publicacoes[0]).toMatchObject({
      tribunal: 'TRT3',
      origem: 'trt3_dejt',
      data_publicacao: '2026-05-15',
      numero_processo: '0010000-00.2026.5.03.0001',
      termo_encontrado: 'ADVOGADO TESTE',
    })
  })

  it('respeita filtro de data quando a edição do DEJT não corresponde', async () => {
    const pdf = Buffer.from([
      '<< /Length 200 >>',
      'stream',
      '(Data da disponibilização: Sexta-feira, 15 de Maio de 2026. ADVOGADO TESTE.) Tj',
      'endstream',
    ].join('\n'), 'latin1')

    const publicacoes = await buscarPublicacoesTRT3DEJT({
      nomes: ['ADVOGADO TESTE'],
      data: '2026-05-16',
      pdfBuffer: pdf,
    })

    expect(publicacoes).toEqual([])
  })

  it('usa fetch público quando nenhum PDF é injetado', async () => {
    const pdf = Buffer.from([
      '<< /Length 200 >>',
      'stream',
      '(Data da disponibilização: Sexta-feira, 15 de Maio de 2026. OAB/MG 123456.) Tj',
      'endstream',
    ].join('\n'), 'latin1')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength)),
    })
    vi.stubGlobal('fetch', fetchMock)

    const publicacoes = await buscarPublicacoesTRT3DEJT({
      nomes: [],
      oabs: ['MG123456'],
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://diario.jt.jus.br/cadernos/Diario_J_03.pdf',
      expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/pdf,*/*;q=0.8' }) }),
    )
    expect(publicacoes).toHaveLength(1)

    vi.unstubAllGlobals()
  })
})
