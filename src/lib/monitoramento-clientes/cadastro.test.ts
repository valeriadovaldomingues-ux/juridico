import { describe, expect, it } from 'vitest'
import { dataValida, listaDeNomes, parseLote, validarEntradaDocumento } from './cadastro'

describe('validarEntradaDocumento', () => {
  it('normaliza documento e nomes', () => {
    const r = validarEntradaDocumento({
      documento: '11.222.333/0001-81', nome_principal: '  Empresa   Exemplo Ltda ',
      nomes_busca: 'Exemplo Comércio; EMPRESA EXEMPLO LTDA.; ; Exemplo Comércio',
      vigencia_inicio: '2026-01-01', contrato_ref: ' C-12 ',
    })
    expect(r).toEqual({
      ok: true,
      valor: {
        documento: '11222333000181', tipo: 'cnpj', nome_principal: 'Empresa Exemplo Ltda',
        nomes_busca: ['Exemplo Comércio'], contrato_ref: 'C-12',
        vigencia_inicio: '2026-01-01', vigencia_fim: null, observacoes: null,
      },
    })
  })
  it('exige nome (não consulta serviço externo) e documento válido', () => {
    expect(validarEntradaDocumento({ documento: '11.222.333/0001-81' })).toMatchObject({ ok: false, erro: expect.stringContaining('nome') })
    expect(validarEntradaDocumento({ documento: '11.222.333/0001-82', nome_principal: 'Empresa' })).toMatchObject({ ok: false })
    expect(validarEntradaDocumento({ documento: '529.982.247-25', nome_principal: 'ab' })).toMatchObject({ ok: false })
  })
  it('valida datas de vigência', () => {
    const base = { documento: '529.982.247-25', nome_principal: 'Maria da Silva' }
    expect(validarEntradaDocumento({ ...base, vigencia_inicio: '31/12/2026' })).toMatchObject({ ok: false })
    expect(validarEntradaDocumento({ ...base, vigencia_inicio: '2026-02-30' })).toMatchObject({ ok: false })
    expect(validarEntradaDocumento({ ...base, vigencia_inicio: '2026-06-01', vigencia_fim: '2026-05-01' })).toMatchObject({ ok: false })
    expect(dataValida('2026-02-28')).toBe(true)
  })
  it('listaDeNomes aceita array ou texto', () => {
    expect(listaDeNomes(['a', 1, 'b'])).toEqual(['a', 'b'])
    expect(listaDeNomes('a;b|c\nd')).toEqual(['a', 'b', 'c', 'd'])
    expect(listaDeNomes(undefined)).toEqual([])
  })
})

describe('parseLote', () => {
  it('lê linhas "documento; nome; alternativo", ignora brancas e comentários', () => {
    const r = parseLote([
      '# clientes do contrato',
      '',
      '11.222.333/0001-81; Empresa Exemplo Ltda; Exemplo Comércio',
      '529.982.247-25;Maria da Silva',
    ].join('\n'))
    expect(r.erros).toEqual([])
    expect(r.linhas).toEqual([
      { linha: 3, documento: '11222333000181', nome_principal: 'Empresa Exemplo Ltda', nomes_busca: ['Exemplo Comércio'] },
      { linha: 4, documento: '52998224725', nome_principal: 'Maria da Silva', nomes_busca: [] },
    ])
  })
  it('aceita TAB (colar de planilha) e vários nomes alternativos', () => {
    const r = parseLote('11.222.333/0001-81\tEmpresa Exemplo\tAlt 1\tAlt 2')
    expect(r.linhas[0].nomes_busca).toEqual(['Alt 1', 'Alt 2'])
  })
  it('linha inválida vai para erros sem barrar as boas; CRLF funciona', () => {
    const r = parseLote('529.982.247-24; Fulano de Tal\r\n529.982.247-25; Maria da Silva\r\n11.222.333/0001-81')
    expect(r.linhas.map(l => l.documento)).toEqual(['52998224725'])
    expect(r.erros.map(e => e.linha)).toEqual([1, 3])
    expect(r.erros[0].erro).toContain('CPF inválido')
    expect(r.erros[1].erro).toContain('nome')
  })
  it('documento repetido no lote: mantém a primeira', () => {
    const r = parseLote('529.982.247-25; Maria da Silva\n52998224725; Maria S.')
    expect(r.linhas).toHaveLength(1)
    expect(r.erros).toEqual([expect.objectContaining({ linha: 2, erro: expect.stringContaining('repetido') })])
  })
})
