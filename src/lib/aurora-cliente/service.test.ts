import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCompletarJSON } = vi.hoisted(() => ({
  mockCompletarJSON: vi.fn(),
}))

vi.mock('@/lib/ai/service', () => ({
  completarJSON: mockCompletarJSON,
}))

import {
  normalizeAuroraClienteContexto,
  normalizeAuroraClienteResposta,
} from './validation'
import { AURORA_CLIENTE_FALLBACK } from './types'
import { gerarRespostaAuroraCliente } from './service'

describe('aurora cliente validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('normaliza resposta fallback quando a IA não retorna dados', () => {
    const parsed = normalizeAuroraClienteResposta({})
    expect(parsed.resposta).toBe(AURORA_CLIENTE_FALLBACK)
    expect(parsed.status).toBe('encaminhada_equipe')
    expect(parsed.precisa_retorno_humano).toBe(true)
  })

  it('normaliza contexto completo', () => {
    const contexto = normalizeAuroraClienteContexto({
      cliente_id: 'cli-1',
      processo: {
        id: 'proc-1',
        numero_processo: '0001',
        titulo: 'Processo Exemplo',
        area_direito: 'civil',
        status: 'ativo',
        fase: 'instrução',
        tribunal: 'TJSP',
        comarca: 'São Paulo',
        vara: '1ª Vara',
        classe_processual: 'Ação',
        assunto: 'Cobrança',
        data_distribuicao: '2026-06-01',
      },
      andamentos: [],
      relatorios: [],
      comunicacoes: [],
      documentos: [],
      timeline: [],
      resumo: { andamentos: 0, relatorios: 0, comunicacoes: 0, documentos: 0, timeline: 0 },
    })

    expect(contexto?.processo.id).toBe('proc-1')
    expect(contexto?.resumo.andamentos).toBe(0)
  })

  it('gera resposta em linguagem simples usando a IA quando há contexto', async () => {
    mockCompletarJSON.mockResolvedValue(JSON.stringify({
      resposta: 'Seu processo teve uma atualização recente.',
      status: 'respondida',
      precisaRetornoHumano: false,
      pontosPrincipais: ['Atualização recente'],
      fontesUsadas: ['andamentos'],
    }))

    const resposta = await gerarRespostaAuroraCliente('Qual foi a última atualização?', {
      cliente_id: 'cli-1',
      processo: {
        id: 'proc-1',
        numero_processo: '0001',
        titulo: 'Processo Exemplo',
        area_direito: 'civil',
        status: 'ativo',
        fase: 'instrução',
        tribunal: 'TJSP',
        comarca: 'São Paulo',
        vara: '1ª Vara',
        classe_processual: 'Ação',
        assunto: 'Cobrança',
        data_distribuicao: '2026-06-01',
      },
      andamentos: [
        { id: 'a1', data_andamento: '2026-06-01T10:00:00Z', tipo: 'decisao', titulo: 'Decisão', origem: 'tribunal' },
      ],
      relatorios: [],
      comunicacoes: [],
      documentos: [],
      timeline: [],
      resumo: { andamentos: 1, relatorios: 0, comunicacoes: 0, documentos: 0, timeline: 0 },
    })

    expect(mockCompletarJSON).toHaveBeenCalledTimes(1)
    expect(resposta.resposta).toContain('atualização recente')
    expect(resposta.status).toBe('respondida')
  })

  it('encaminha para a equipe quando o cliente já pede retorno humano', async () => {
    const resposta = await gerarRespostaAuroraCliente('Preciso de retorno humano', null, {
      precisaRetornoHumano: true,
    })

    expect(resposta.resposta).toBe(AURORA_CLIENTE_FALLBACK)
    expect(resposta.status).toBe('encaminhada_equipe')
    expect(mockCompletarJSON).not.toHaveBeenCalled()
  })
})
