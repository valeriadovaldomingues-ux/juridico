import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard, mockCreateClient, mockGerarDraft } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateClient: vi.fn(),
  mockGerarDraft: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('@/lib/comunicacao-inteligente', async () => {
  const actual = await vi.importActual<typeof import('@/lib/comunicacao-inteligente')>('@/lib/comunicacao-inteligente')
  return {
    ...actual,
    gerarComunicacaoInteligenteDraft: mockGerarDraft,
  }
})

import { GET, POST } from './route'

const PROCESSO_UUID = '550e8400-e29b-41d4-a716-446655440010'
const ANDAMENTO_UUID = '550e8400-e29b-41d4-a716-446655440011'
const COMUNICACAO_UUID = '550e8400-e29b-41d4-a716-446655440012'

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

describe('GET /api/processos/[id]/comunicacoes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('bloqueia perfis sem acesso', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await GET(new Request(`http://localhost/api/processos/${PROCESSO_UUID}/comunicacoes`), {
      params: Promise.resolve({ id: PROCESSO_UUID }),
    } as any)

    expect(res.status).toBe(403)
  })

  it('lista comunicações transformando snake_case em camelCase', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })
    mockCreateClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'comunicacoes_inteligentes') {
          return makeChain({
            data: [{
              id: COMUNICACAO_UUID,
              cliente_id: 'cli-1',
              processo_id: PROCESSO_UUID,
              andamento_ids: [ANDAMENTO_UUID],
              tipo: 'relatorio',
              canal_destino: 'portal',
              status: 'pendente_aprovacao',
              titulo: 'Atualização',
              resumo_executivo: 'Resumo',
              o_que_aconteceu: 'Fato',
              o_que_isso_significa: 'Significado',
              proximos_passos: ['Passo'],
              acao_necessaria_cliente: 'Aguardar',
              mensagem_cliente: 'Mensagem',
              observacoes_internas: 'Obs',
              campos_nao_encontrados: ['Campo'],
              inconsistencias: ['Inconsistência'],
              conteudo_json: {
                resumoExecutivo: 'Resumo',
                oQueAconteceu: 'Fato',
                oQueIssoSignifica: 'Significado',
                proximosPassos: ['Passo'],
                acaoNecessariaCliente: 'Aguardar',
                mensagemCliente: 'Mensagem',
                observacoesInternas: 'Obs',
                camposNaoEncontrados: ['Campo'],
                inconsistencias: ['Inconsistência'],
              },
              conteudo_texto: 'Texto',
              visivel_portal: false,
              aprovado_por: null,
              aprovado_em: null,
              enviado_por: null,
              enviado_em: null,
              portal_mensagem_id: null,
              criado_por: 'uid',
              atualizado_por: null,
              created_at: '2026-06-01T10:15:00Z',
              updated_at: '2026-06-01T10:15:00Z',
              criado_por_profile: null,
              aprovado_por_profile: null,
              enviado_por_profile: null,
            }],
            error: null,
          })
        }
        return makeChain({ data: [], error: null })
      }),
    })

    const res = await GET(new Request(`http://localhost/api/processos/${PROCESSO_UUID}/comunicacoes`), {
      params: Promise.resolve({ id: PROCESSO_UUID }),
    } as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({
      id: COMUNICACAO_UUID,
      resumoExecutivo: 'Resumo',
      oQueAconteceu: 'Fato',
      canal_destino: 'portal',
    })
  })
})

describe('POST /api/processos/[id]/comunicacoes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('gera e salva uma comunicação pendente de aprovação', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })
    mockGerarDraft.mockResolvedValue({
      tipo: 'relatorio',
      canal_destino: 'portal',
      titulo: 'Atualização',
      resumoExecutivo: 'Resumo',
      oQueAconteceu: 'Fato',
      oQueIssoSignifica: 'Significado',
      proximosPassos: ['Passo'],
      acaoNecessariaCliente: 'Aguardar',
      mensagemCliente: 'Mensagem',
      observacoesInternas: 'Obs',
      camposNaoEncontrados: ['Campo'],
      inconsistencias: ['Inconsistência'],
      conteudo_json: {
        resumoExecutivo: 'Resumo',
        oQueAconteceu: 'Fato',
        oQueIssoSignifica: 'Significado',
        proximosPassos: ['Passo'],
        acaoNecessariaCliente: 'Aguardar',
        mensagemCliente: 'Mensagem',
        observacoesInternas: 'Obs',
        camposNaoEncontrados: ['Campo'],
        inconsistencias: ['Inconsistência'],
      },
      conteudo_texto: 'Texto',
    })

    const query = makeChain({
      data: {
        id: COMUNICACAO_UUID,
        cliente_id: 'cli-1',
        processo_id: PROCESSO_UUID,
        andamento_ids: [ANDAMENTO_UUID],
        tipo: 'relatorio',
        canal_destino: 'portal',
        status: 'pendente_aprovacao',
        titulo: 'Atualização',
        resumo_executivo: 'Resumo',
        o_que_aconteceu: 'Fato',
        o_que_isso_significa: 'Significado',
        proximos_passos: ['Passo'],
        acao_necessaria_cliente: 'Aguardar',
        mensagem_cliente: 'Mensagem',
        observacoes_internas: 'Obs',
        campos_nao_encontrados: ['Campo'],
        inconsistencias: ['Inconsistência'],
        conteudo_json: {
          resumoExecutivo: 'Resumo',
          oQueAconteceu: 'Fato',
          oQueIssoSignifica: 'Significado',
          proximosPassos: ['Passo'],
          acaoNecessariaCliente: 'Aguardar',
          mensagemCliente: 'Mensagem',
          observacoesInternas: 'Obs',
          camposNaoEncontrados: ['Campo'],
          inconsistencias: ['Inconsistência'],
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

    const logChain = makeChain({ data: null, error: null })

    mockCreateClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'processos') {
          return makeChain({
            data: {
              id: PROCESSO_UUID,
              numero_processo: '0001234-56.2026.8.26.0100',
              titulo: 'Processo Exemplo',
              area_direito: 'civil',
              status: 'ativo',
              fase: 'instrução',
              tribunal: 'TJSP',
              comarca: 'São Paulo',
              vara: '1ª Vara',
              classe_processual: 'Ação',
              assunto: 'Cobrança',
              segredo_justica: false,
              cliente_id: 'cli-1',
              cliente: {
                id: 'cli-1',
                nome: 'Cliente Exemplo',
                cpf_cnpj: '12.345.678/0001-90',
                email: 'cliente@example.com',
                telefone: '1133334444',
                celular: '11999998888',
              },
            },
            error: null,
          })
        }
        if (table === 'processo_andamentos') {
          return makeChain({
            data: [{
              id: ANDAMENTO_UUID,
              processo_id: PROCESSO_UUID,
              data_andamento: '2026-06-01T10:15:00Z',
              tipo: 'decisao',
              titulo: 'Decisão',
              descricao: 'Descrição',
              origem: 'tribunal',
              responsavel: { nome: 'Advogada' },
              criado_por_profile: { nome: 'Sócio' },
            }],
            error: null,
          })
        }
        if (table === 'comunicacoes_inteligentes') {
          return query
        }
        if (table === 'comunicacoes_inteligentes_logs') {
          return logChain
        }
        return makeChain({ data: [], error: null })
      }),
    })

    const res = await POST(
      new Request(`http://localhost/api/processos/${PROCESSO_UUID}/comunicacoes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tipo: 'relatorio', canal_destino: 'portal' }),
      }),
      { params: Promise.resolve({ id: PROCESSO_UUID }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toMatchObject({
      id: COMUNICACAO_UUID,
      status: 'pendente_aprovacao',
      resumoExecutivo: 'Resumo',
    })
    expect(mockGerarDraft).toHaveBeenCalledTimes(1)
    expect(query.insert).toHaveBeenCalled()
    expect(logChain.insert).toHaveBeenCalled()
  })
})
