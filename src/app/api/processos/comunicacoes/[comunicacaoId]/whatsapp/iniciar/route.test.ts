import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockApiGuard, mockCreateClient } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { POST } from './route'

const COMUNICACAO_UUID = '550e8400-e29b-41d4-a716-446655440030'
const CLIENTE_UUID = '550e8400-e29b-41d4-a716-446655440031'

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    order: vi.fn(() => chain),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: { data: unknown; error: unknown }) => void, reject?: (error: unknown) => void) => Promise.resolve(result).then(resolve, reject),
  }
  return chain
}

describe('POST /api/processos/comunicacoes/[comunicacaoId]/whatsapp/iniciar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('gera link do WhatsApp para contato ativo do cliente', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })

    const comunicacaoChain = makeChain({
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

    const clienteChain = makeChain({
      data: {
        id: CLIENTE_UUID,
        nome: 'Cliente Teste',
        celular: '11999998888',
        telefone: '1133334444',
      },
      error: null,
    })

    const logChain = makeChain({ data: null, error: null })

    mockCreateClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'comunicacoes_inteligentes') return comunicacaoChain
        if (table === 'clientes') return clienteChain
        if (table === 'comunicacoes_inteligentes_logs') return logChain
        return makeChain({ data: null, error: null })
      }),
    })

    const res = await POST(
      new Request(`http://localhost/api/processos/comunicacoes/${COMUNICACAO_UUID}/whatsapp/iniciar`, {
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
    expect(body.url).toContain('wa.me/5511999998888')
    expect(body.mensagem).toContain('Assunto: Atualização do processo')
    expect(body.mensagem).not.toContain('Observação interna')
    expect(body.destinatario.nome).toBe('Cliente Teste')
  })
})
