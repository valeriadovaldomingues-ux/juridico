import { describe, expect, it } from 'vitest'
import {
  detectarIntencaoPublicacoes,
  montarContextoPublicacoesParaAurora,
  type PublicacaoAurora,
} from './aurora-context'

const basePublicacao: PublicacaoAurora = {
  id: 'pub-1',
  numero_processo: '1234567-89.2024.8.13.0001',
  tribunal: 'TJMG',
  orgao: '1ª Vara Cível',
  diario: 'DJe',
  data_publicacao: '2026-05-18',
  resumo: 'Intimação para manifestação em prazo processual.',
  tipo_publicacao: 'intimacao',
  prazo_detectado: true,
  prazo_dias: 5,
  prazo_data: '2026-05-23',
  prazo_descricao: 'Prazo de 5 dias para manifestação',
  audiencia_detectada: false,
  audiencia_data: null,
  audiencia_descricao: null,
  status: 'nao_tratada',
  origem: 'manual',
  processo_id: 'proc-1',
  processo: {
    id: 'proc-1',
    titulo: 'Ação de cobrança',
    numero_processo: '1234567-89.2024.8.13.0001',
  },
}

describe('detectarIntencaoPublicacoes', () => {
  it('detecta pedido de publicações de hoje com providência urgente', () => {
    const result = detectarIntencaoPublicacoes(
      'Aurora, quais publicações chegaram hoje e quais exigem providência urgente?',
    )

    expect(result.temIntencao).toBe(true)
    expect(result.hoje).toBe(true)
  })

  it('detecta prazo e audiência com acentos', () => {
    const result = detectarIntencaoPublicacoes(
      'Existem intimações com prazo detectado ou audiência detectada?',
    )

    expect(result.temIntencao).toBe(true)
    expect(result.prazo).toBe(true)
    expect(result.audiencia).toBe(true)
  })

  it('não detecta publicações em pedido executivo genérico', () => {
    const result = detectarIntencaoPublicacoes('Monte um plano de ação para a reunião')

    expect(result.temIntencao).toBe(false)
  })
})

describe('montarContextoPublicacoesParaAurora', () => {
  it('monta contexto resumido sem texto_publicacao nem campos sensíveis', () => {
    const contexto = montarContextoPublicacoesParaAurora([
      {
        ...basePublicacao,
        // Campo propositalmente fora do tipo permitido para garantir que não vaze.
        texto_publicacao: 'Texto completo com CPF 000.000.000-00 e valor R$ 1.000.000,00',
      } as PublicacaoAurora & { texto_publicacao: string },
    ])

    expect(contexto).toContain('CONTEXTO DO SISTEMA - PUBLICAÇÕES')
    expect(contexto).toContain('Total encontrado: 1')
    expect(contexto).toContain('Com prazo detectado: 1')
    expect(contexto).toContain('Pendentes de triagem/não tratadas: 1')
    expect(contexto).not.toContain('Texto completo')
    expect(contexto).not.toContain('000.000.000-00')
    expect(contexto).not.toContain('1.000.000,00')
  })

  it('informa ausência de publicações quando lista está vazia', () => {
    const contexto = montarContextoPublicacoesParaAurora([])

    expect(contexto).toContain('não encontrei publicações')
  })
})
