import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockApiGuard, mockCreateClient } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { DELETE, PATCH } from './route'

const COMUNICACAO_UUID = '550e8400-e29b-41d4-a716-446655440020'
const PROCESSO_UUID = '550e8400-e29b-41d4-a716-446655440021'
const ANDAMENTO_UUID = '550e8400-e29b-41d4-a716-446655440022'

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    in: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(async () => result),
    then: (resolve: (value: { data: unknown; error: unknown }) => void, reject?: (error: unknown) => void) => Promise.resolve(result).then(resolve, reject),
  }
  return chain
}

describe('PATCH /api/processos/comunicacoes/[comunicacaoId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('atualiza uma comunicação mantendo o formato da UI', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })

    const selectChain = makeChain({
      data: {
        id: COMUNICACAO_UUID,
        cliente_id: 'cli-1',
        processo_id: PROCESSO_UUID,
        andamento_ids: [ANDAMENTO_UUID],
        tipo: 'relatorio',
        canal_destino: 'portal',
        status: 'pendente_aprovacao',
        titulo: 'Título atualizado',
        resumo_executivo: 'Resumo inicial',
        o_que_aconteceu: 'Fato inicial',
        o_que_isso_significa: 'Significado inicial',
        proximos_passos: ['Passo 1'],
        acao_necessaria_cliente: 'Aguardar',
        mensagem_cliente: 'Mensagem',
        observacoes_internas: 'Obs',
        campos_nao_encontrados: ['Campo'],
        inconsistencias: [],
        conteudo_json: {
          resumoExecutivo: 'Resumo inicial',
          oQueAconteceu: 'Fato inicial',
          oQueIssoSignifica: 'Significado inicial',
          proximosPassos: ['Passo 1'],
          acaoNecessariaCliente: 'Aguardar',
          mensagemCliente: 'Mensagem',
          observacoesInternas: 'Obs',
          camposNaoEncontrados: ['Campo'],
          inconsistencias: [],
        },
        conteudo_texto: 'Texto',
        visivel_portal: false,
        aprovado_por: null,
        aprovado_em: null,
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

    mockCreateClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'comunicacoes_inteligentes') {
          return {
            ...selectChain,
            update: vi.fn(() => selectChain),
          }
        }
        return makeChain({ data: null, error: null })
      }),
    })

    const res = await PATCH(
      new Request(`http://localhost/api/processos/comunicacoes/${COMUNICACAO_UUID}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          titulo: 'Título atualizado',
          resumoExecutivo: 'Resumo atualizado',
          canal_destino: 'portal',
        }),
      }),
      { params: Promise.resolve({ comunicacaoId: COMUNICACAO_UUID }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      id: COMUNICACAO_UUID,
      titulo: 'Título atualizado',
      resumoExecutivo: 'Resumo inicial',
    })
  })
})

describe('DELETE /api/processos/comunicacoes/[comunicacaoId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('descarta comunicação pendente', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })

    const selectChain = makeChain({
      data: { id: COMUNICACAO_UUID, status: 'pendente_aprovacao' },
      error: null,
    })
    const updateChain = makeChain({ data: null, error: null })

    mockCreateClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'comunicacoes_inteligentes') {
          return {
            ...selectChain,
            update: vi.fn(() => updateChain),
          }
        }
        return makeChain({ data: null, error: null })
      }),
    })

    const res = await DELETE(new Request(`http://localhost/api/processos/comunicacoes/${COMUNICACAO_UUID}`, {
      method: 'DELETE',
    }), { params: Promise.resolve({ comunicacaoId: COMUNICACAO_UUID }) } as any)

    expect(res.status).toBe(204)
  })
})
