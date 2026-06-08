import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockPortalGuard, mockCreateClient, mockBuscarContexto, mockGerarResposta, mockSalvarConversa } = vi.hoisted(() => ({
  mockPortalGuard: vi.fn(),
  mockCreateClient: vi.fn(),
  mockBuscarContexto: vi.fn(),
  mockGerarResposta: vi.fn(),
  mockSalvarConversa: vi.fn(),
}))

vi.mock('@/lib/auth/portal-guard', () => ({ portalGuard: mockPortalGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('@/lib/aurora-cliente', async () => {
  const actual = await vi.importActual<typeof import('@/lib/aurora-cliente')>('@/lib/aurora-cliente')
  return {
    ...actual,
    buscarContextoAuroraCliente: mockBuscarContexto,
    gerarRespostaAuroraCliente: mockGerarResposta,
    salvarConversaAuroraCliente: mockSalvarConversa,
  }
})

import { POST } from './route'

const PROCESSO_UUID = '550e8400-e29b-41d4-a716-446655440101'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/portal/processos/[id]/aurora-cliente/perguntar', () => {
  it('gera resposta e salva a conversa', async () => {
    mockPortalGuard.mockResolvedValue({ userId: 'user-1', clienteId: 'cliente-1', clienteNome: 'Cliente' })
    mockCreateClient.mockResolvedValue({})
    mockBuscarContexto.mockResolvedValue({
      cliente_id: 'cliente-1',
      processo: {
        id: PROCESSO_UUID,
        numero_processo: '0001234-56.2026.8.26.0100',
        titulo: 'Processo exemplo',
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
    mockGerarResposta.mockResolvedValue({
      resposta: 'Foi publicada uma decisão.',
      status: 'respondida',
      precisa_retorno_humano: false,
      pontos_principais: ['Decisão publicada'],
      fontes_usadas: ['andamentos'],
    })
    mockSalvarConversa.mockResolvedValue({
      id: 'conv-1',
      cliente_id: 'cliente-1',
      processo_id: PROCESSO_UUID,
      pergunta: 'Qual foi a última atualização?',
      resposta: 'Foi publicada uma decisão.',
      status: 'respondida',
      precisa_retorno_humano: false,
      created_at: '2026-06-01T10:00:00Z',
      created_by: 'user-1',
    })

    const res = await POST(new Request(`http://localhost/api/portal/processos/${PROCESSO_UUID}/aurora-cliente/perguntar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pergunta: 'Qual foi a última atualização?' }),
    }), {
      params: Promise.resolve({ id: PROCESSO_UUID }),
    } as any)

    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.resposta).toBe('Foi publicada uma decisão.')
    expect(mockSalvarConversa).toHaveBeenCalledTimes(1)
  })

  it('bloqueia JSON inválido e pergunta vazia', async () => {
    mockPortalGuard.mockResolvedValue({ userId: 'user-1', clienteId: 'cliente-1', clienteNome: 'Cliente' })
    mockCreateClient.mockResolvedValue({})

    const res = await POST(new Request(`http://localhost/api/portal/processos/${PROCESSO_UUID}/aurora-cliente/perguntar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pergunta: '   ' }),
    }), {
      params: Promise.resolve({ id: PROCESSO_UUID }),
    } as any)

    expect(res.status).toBe(400)
  })
})
