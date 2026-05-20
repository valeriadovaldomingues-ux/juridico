import { describe, expect, it } from 'vitest'
import { buscarModeloPeticao, CATALOGO_PETICOES, GRUPOS_PETICOES } from './catalogo-peticoes'

describe('catálogo de modelos de petição', () => {
  it('importa o catálogo extraído do Lovable com grupos e modelos deduplicados', () => {
    expect(GRUPOS_PETICOES).toHaveLength(18)
    expect(CATALOGO_PETICOES).toHaveLength(279)

    expect(GRUPOS_PETICOES.map(grupo => grupo.grupo)).toEqual([
      'Cível — Conhecimento (ações)',
      'Cível — Procedimentos Especiais',
      'Cível — Execução e Cumprimento',
      'Cível — Cautelares e Tutelas',
      'Cível — Defesas e Manifestações',
      'Cível — Recursos',
      'Juizado Especial Cível',
      'Família e Sucessões',
      'Consumidor',
      'Empresarial e Recuperacional',
      'Tributário e Administrativo',
      'Trabalhista — Empregado (autor)',
      'Trabalhista — Defesa / Empregador',
      'Trabalhista — Manifestações e Memoriais',
      'Trabalhista — Recursos',
      'Trabalhista — Dissídios Coletivos e Sindicais',
      'Criminal e Constitucional',
      'Extrajudicial / Outras',
    ])

    const ids = CATALOGO_PETICOES.map(modelo => modelo.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(CATALOGO_PETICOES.filter(modelo => modelo.nomeExibido === 'Ação Monitória')).toHaveLength(1)
  })

  it('inclui os modelos destacados no escopo do gerador', () => {
    expect(buscarModeloPeticao('acao-de-cobranca')?.nomeExibido).toBe('Ação de Cobrança')
    expect(buscarModeloPeticao('acao-de-usucapiao-ordinaria')?.nomeExibido).toBe('Ação de Usucapião Ordinária')
    expect(buscarModeloPeticao('acao-monitoria')?.nomeExibido).toBe('Ação Monitória')
    expect(buscarModeloPeticao('embargos-de-terceiro')?.nomeExibido).toBe('Embargos de Terceiro')
    expect(buscarModeloPeticao('apelacao')?.nomeExibido).toBe('Apelação')
    expect(buscarModeloPeticao('recurso-ordinario')?.nomeExibido).toBe('Recurso Ordinário')
    expect(buscarModeloPeticao('reclamacao-trabalhista')?.nomeExibido).toBe('Reclamação Trabalhista')
    expect(buscarModeloPeticao('divorcio-litigioso')?.nomeExibido).toBe('Divórcio Litigioso')
    expect(buscarModeloPeticao('inventario-e-partilha')?.nomeExibido).toBe('Inventário e Partilha')
    expect(buscarModeloPeticao('mandado-de-seguranca')?.nomeExibido).toBe('Mandado de Segurança')
    expect(buscarModeloPeticao('habeas-corpus')?.nomeExibido).toBe('Habeas Corpus')
    expect(buscarModeloPeticao('notificacao-extrajudicial')?.nomeExibido).toBe('Notificação Extrajudicial')
  })

  it('define endereçamentos genéricos por categoria', () => {
    expect(buscarModeloPeticao('acao-de-cobranca')?.enderecamentoPadrao).toBe('EXMO. SR. JUIZ DE DIREITO DA ___ VARA CÍVEL DA COMARCA DE ___/UF.')
    expect(buscarModeloPeticao('peticao-inicial-jec')?.enderecamentoPadrao).toBe('EXMO. SR. JUIZ DE DIREITO DO ___ JUIZADO ESPECIAL CÍVEL DA COMARCA DE ___/UF.')
    expect(buscarModeloPeticao('divorcio-litigioso')?.enderecamentoPadrao).toBe('EXMO. SR. JUIZ DE DIREITO DA ___ VARA DE FAMÍLIA E SUCESSÕES DA COMARCA DE ___/UF.')
    expect(buscarModeloPeticao('reclamacao-trabalhista')?.enderecamentoPadrao).toBe('EXMO. SR. JUIZ DA ___ VARA DO TRABALHO DE ___/UF.')
    expect(buscarModeloPeticao('mandado-de-seguranca')?.enderecamentoPadrao).toBe('EXMO. SR. JUIZ DE DIREITO DA ___ VARA DA FAZENDA PÚBLICA DA COMARCA DE ___/UF.')
    expect(buscarModeloPeticao('queixa-crime')?.enderecamentoPadrao).toBe('EXMO. SR. JUIZ DE DIREITO DA ___ VARA CRIMINAL DA COMARCA DE ___/UF.')
    expect(buscarModeloPeticao('apelacao')?.enderecamentoPadrao).toBe('AO JUÍZO OU TRIBUNAL COMPETENTE, CONFORME A PEÇA RECURSAL.')
  })

  it('prepara metadados completos para modelos essenciais', () => {
    const cobranca = buscarModeloPeticao('acao-de-cobranca')
    const usucapiao = buscarModeloPeticao('acao-de-usucapiao-ordinaria')
    const monitoria = buscarModeloPeticao('acao-monitoria')
    const recurso = buscarModeloPeticao('apelacao')
    const trabalhista = buscarModeloPeticao('reclamacao-trabalhista')

    for (const modelo of [cobranca, usucapiao, monitoria, recurso, trabalhista]) {
      expect(modelo?.id).toBeTruthy()
      expect(modelo?.grupo).toBeTruthy()
      expect(modelo?.nomeAcao).toBe(modelo?.nomeExibido.toUpperCase())
      expect(modelo?.enderecamentoPadrao).toBeTruthy()
      expect(modelo?.topicosBase.length).toBeGreaterThan(0)
      expect(modelo?.pedidosSugeridos.length).toBeGreaterThan(0)
    }

    expect(recurso?.topicosBase).toContain('DA TEMPESTIVIDADE')
    expect(trabalhista?.topicosBase).toContain('DO CONTRATO DE TRABALHO')
  })
})
