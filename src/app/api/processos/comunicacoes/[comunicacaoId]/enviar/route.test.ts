import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockApiGuard, mockCreateClient } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { POST } from './route'

const COMUNICACAO_UUID = '550e8400-e29b-41d4-a716-446655440030'

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

describe('POST /api/processos/comunicacoes/[comunicacaoId]/enviar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('envia comunicação aprovada ao portal e retorna formato compatível com UI', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })

    const currentChain = makeChain({
      data: {
        id: COMUNICACAO_UUID,
        cliente_id: 'cli-1',
        processo_id: '550e8400-e29b-41d4-a716-446655440031',
        titulo: 'Título',
        conteudo_texto: 'Texto principal',
        mensagem_cliente: 'Mensagem',
        status: 'aprovada',
        canal_destino: 'portal',
      },
      error: null,
    })
    const portalMensagemChain = makeChain({
      data: { id: 'pm-1' },
      error: null,
    })
    const updateChain = makeChain({
      data: {
        id: COMUNICACAO_UUID,
        cliente_id: 'cli-1',
        processo_id: '550e8400-e29b-41d4-a716-446655440031',
        andamento_ids: [],
        tipo: 'relatorio',
        canal_destino: 'portal',
        status: 'enviada',
        titulo: 'Título',
        resumo_executivo: 'Resumo',
        o_que_aconteceu: 'Fato',
        o_que_isso_significa: 'Significado',
        proximos_passos: [],
        acao_necessaria_cliente: 'Aguardar',
        mensagem_cliente: 'Mensagem',
        observacoes_internas: 'Obs',
        campos_nao_encontrados: [],
        inconsistencias: [],
        conteudo_json: {
          resumoExecutivo: 'Resumo',
          oQueAconteceu: 'Fato',
          oQueIssoSignifica: 'Significado',
          proximosPassos: [],
          acaoNecessariaCliente: 'Aguardar',
          mensagemCliente: 'Mensagem',
          observacoesInternas: 'Obs',
          camposNaoEncontrados: [],
          inconsistencias: [],
        },
        conteudo_texto: 'Texto principal',
        visivel_portal: true,
        aprovado_por: 'uid',
        aprovado_em: '2026-06-01T10:15:00Z',
        enviado_por: 'uid',
        enviado_em: '2026-06-01T10:20:00Z',
        portal_mensagem_id: 'pm-1',
        criado_por: 'uid',
        atualizado_por: 'uid',
        created_at: '2026-06-01T10:15:00Z',
        updated_at: '2026-06-01T10:20:00Z',
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
            ...currentChain,
            update: vi.fn(() => updateChain),
          }
        }
        if (table === 'portal_mensagens') {
          return portalMensagemChain
        }
        if (table === 'comunicacoes_inteligentes_logs') {
          return makeChain({ data: null, error: null })
        }
        return makeChain({ data: null, error: null })
      }),
    })

    const res = await POST(new Request(`http://localhost/api/processos/comunicacoes/${COMUNICACAO_UUID}/enviar`, {
      method: 'POST',
    }), { params: Promise.resolve({ comunicacaoId: COMUNICACAO_UUID }) } as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      id: COMUNICACAO_UUID,
      status: 'enviada',
      visivel_portal: true,
      portal_mensagem_id: 'pm-1',
    })
    expect(portalMensagemChain.insert).toBeDefined()
  })
})
