import { describe, expect, it } from 'vitest'
import {
  buildObservacoesImportacao,
  escolherValorImportado,
  normalizeProcessoImportacao,
} from './importar-documento'

describe('processos importar-documento helpers', () => {
  it('normaliza a estrutura extraída pelo importador', () => {
    const dados = normalizeProcessoImportacao({
      cliente: {
        nome: '  Empresa Alfa  ',
        cpfCnpj: ' 12.345.678/0001-90 ',
        telefone: '(11) 99999-0000',
        email: 'contato@alfa.com',
        endereco: ' Rua A, 10 ',
      },
      parteContraria: {
        nome: '  Empresa Beta ',
      },
      processo: {
        numero: ' 0001234-56.2026.8.26.0100 ',
        segredoJustica: 'sim',
      },
      advogados: [
        { nome: ' Dra. Ana ', oab: ' SP 12345 ', representa: 'cliente' },
      ],
      resumo: {
        fatosRelevantes: 'fato 1\nfato 2',
      },
      observacoes: {
        camposNaoEncontrados: ['campo 1', 'campo 2'],
      },
    })

    expect(dados.cliente.nome).toBe('Empresa Alfa')
    expect(dados.cliente.cpfCnpj).toBe('12.345.678/0001-90')
    expect(dados.processo.numero).toBe('0001234-56.2026.8.26.0100')
    expect(dados.processo.segredoJustica).toBe(true)
    expect(dados.advogados).toEqual([
      expect.objectContaining({
        nome: 'Dra. Ana',
        oab: 'SP 12345',
        representa: 'cliente',
      }),
    ])
    expect(dados.resumo.fatosRelevantes).toEqual(['fato 1', 'fato 2'])
  })

  it('monta observações legíveis para o processo', () => {
    const texto = buildObservacoesImportacao(normalizeProcessoImportacao({
      cliente: { nome: 'Empresa Alfa', cpfCnpj: '12345678000190' },
      parteContraria: { nome: 'Empresa Beta' },
      processo: {
        comarca: 'São Paulo',
        classe: 'Procedimento Comum',
        assunto: 'Cobrança',
        segredoJustica: false,
      },
      resumo: {
        resumoCaso: 'Caso de cobrança contratual.',
        pedidosPrincipais: ['Cobrança do principal'],
      },
      observacoes: {
        camposNaoEncontrados: ['valor da causa'],
        inconsistencias: ['O documento cita dois números de processo'],
        observacoesInternas: 'Conferir documentos anexos.',
      },
    }))

    expect(texto).toContain('Resumo do caso:')
    expect(texto).toContain('Cliente sugerido: Empresa Alfa')
    expect(texto).toContain('Dados jurídicos identificados:')
    expect(texto).toContain('Segredo de justiça: Não')
    expect(texto).toContain('Campos não encontrados:')
    expect(texto).toContain('Inconsistências identificadas:')
  })

  it('respeita a estratégia de preenchimento', () => {
    expect(escolherValorImportado('', 'novo', 'preencher_vazios')).toBe('novo')
    expect(escolherValorImportado('já existe', 'novo', 'preencher_vazios')).toBe('já existe')
    expect(escolherValorImportado('já existe', 'novo', 'substituir')).toBe('novo')
  })
})

