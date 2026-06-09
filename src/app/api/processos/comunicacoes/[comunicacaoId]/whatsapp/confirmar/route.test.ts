import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockApiGuard, mockCreateClient } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { POST } from './route'

const COMUNICACAO_UUID = '550e8400-e29b-41d4-a716-446655440040'
const CLIENTE_UUID = '550e8400-e29b-41d4-a716-446655440041'

function makeMutableChain(initial: { data: unknown; error: unknown }) {
  const state = { result: initial }
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    order: vi.fn(() => chain),
    single: vi.fn(async () => state.result),
    maybeSingle: vi.fn(async () => state.result),
    then: (resolve: (value: { data: unknown; error: unknown }) => void, reject?: (error: unknown) => void) => Promise.resolve(state.result).then(resolve, reject),
    __setResult(next: { data: unknown; error: unknown }) {
      state.result = next
      return chain
    },
  }
  return chain
}

describe('POST /api/processos/comunicacoes/[comunicacaoId]/whatsapp/confirmar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marca a comunicação como enviada_manual_whatsapp', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })

    const comunicacaoChain: any = makeMutableChain({
      data: {
        id: COMUNICACAO_UUID,
        cliente_id: CLIENTE_UUID,
        processo_id: 'proc-1',
        andamento_ids: [],
        tipo: 'relatorio',
        canal_destino: 'portal',
        status: 'aprovada',
        titulo: 'Atualização do processo',
        resumo_executivo: 'Resumo',
        o_que_aconteceu: 'Fato',
        o_que_isso_significa: 'Significado',
        proximos_passos: ['Passo 1'],
        acao_necessaria_cliente: 'Aguardar',
        mensagem_cliente: 'Mensagem ao cliente',
        observacoes_internas: 'Observação interna',
        campos_nao_encontrados: [],
        inconsistencias: [],
        conteudo_json: {
          resumoExecutivo: 'Resumo',
          oQueAconteceu: 'Fato',
          oQueIssoSignifica: 'Significado',
          proximosPassos: ['Passo 1'],
          acaoNecessariaCliente: 'Aguardar',
          mensagemCliente: 'Mensagem ao cliente',
          observacoesInternas: 'Observação interna',
          camposNaoEncontrados: [],
          inconsistencias: [],
        },
        conteudo_texto: 'Texto',
        visivel_portal: false,
        aprovado_por: 'uid',
        aprovado_em: '2026-06-01T10:15:00Z',
        enviado_por: null,
        enviado_em: null,
        portal_mensagem_id: null,
        criado_por: 'uid',
        atualizado_por: 'uid',
        created_at: '2026-06-01T10:15:00Z',
        updated_at: '2026-06-01T10:15:00Z',
        criado_por_profile: null,
        aprovado_por_profile: null,
        enviado_por_profile: null,
      },
      error: null,
    })

    const clienteChain = makeMutableChain({
      data: {
        id: CLIENTE_UUID,
        nome: 'Cliente Teste',
        celular: '11999998888',
        telefone: '1133334444',
      },
      error: null,
    })

    const logsChain = makeMutableChain({ data: null, error: null })
    const updatedCommunication = {
      id: COMUNICACAO_UUID,
      cliente_id: CLIENTE_UUID,
      processo_id: 'proc-1',
      andamento_ids: [],
      tipo: 'relatorio',
      canal_destino: 'whatsapp',
      status: 'enviada_manual_whatsapp',
      titulo: 'Atualização do processo',
      resumo_executivo: 'Resumo',
      o_que_aconteceu: 'Fato',
      o_que_isso_significa: 'Significado',
      proximos_passos: ['Passo 1'],
      acao_necessaria_cliente: 'Aguardar',
      mensagem_cliente: 'Mensagem ao cliente',
      observacoes_internas: 'Observação interna',
      campos_nao_encontrados: [],
      inconsistencias: [],
      conteudo_json: {
        resumoExecutivo: 'Resumo',
        oQueAconteceu: 'Fato',
        oQueIssoSignifica: 'Significado',
        proximosPassos: ['Passo 1'],
        acaoNecessariaCliente: 'Aguardar',
        mensagemCliente: 'Mensagem ao cliente',
        observacoesInternas: 'Observação interna',
        camposNaoEncontrados: [],
        inconsistencias: [],
      },
      conteudo_texto: 'Texto',
      visivel_portal: false,
      aprovado_por: 'uid',
      aprovado_em: '2026-06-01T10:15:00Z',
      enviado_por: 'uid',
      enviado_em: '2026-06-01T11:00:00Z',
      portal_mensagem_id: null,
      criado_por: 'uid',
      atualizado_por: 'uid',
      created_at: '2026-06-01T10:15:00Z',
      updated_at: '2026-06-01T11:00:00Z',
      criado_por_profile: null,
      aprovado_por_profile: null,
      enviado_por_profile: null,
    }

    comunicacaoChain.update.mockImplementation(() => {
      comunicacaoChain.__setResult({ data: updatedCommunication, error: null })
      return comunicacaoChain
    })

    mockCreateClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'comunicacoes_inteligentes') return comunicacaoChain
        if (table === 'clientes') return clienteChain
        if (table === 'comunicacoes_inteligentes_logs') return logsChain
        if (table === 'cliente_contatos') return makeMutableChain({ data: null, error: null })
        return makeMutableChain({ data: null, error: null })
      }),
    })

    const res = await POST(
      new Request(`http://localhost/api/processos/comunicacoes/${COMUNICACAO_UUID}/whatsapp/confirmar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          destinatario_tipo: 'cliente',
          telefone: '11 99999-8888',
        }),
      }),
      { params: Promise.resolve({ comunicacaoId: COMUNICACAO_UUID }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('enviada_manual_whatsapp')
    expect(body.canal_destino).toBe('whatsapp')
    expect(comunicacaoChain.update).toHaveBeenCalled()
  })
})
