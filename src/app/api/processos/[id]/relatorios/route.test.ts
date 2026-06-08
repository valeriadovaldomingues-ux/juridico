import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const {
  mockApiGuard,
  mockCreateClient,
  mockBuscarProcesso,
  mockBuscarAndamentos,
  mockGerarDraft,
  mockMapRelatorio,
  mockRegistrarLog,
} = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateClient: vi.fn(),
  mockBuscarProcesso: vi.fn(),
  mockBuscarAndamentos: vi.fn(),
  mockGerarDraft: vi.fn(),
  mockMapRelatorio: vi.fn(),
  mockRegistrarLog: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('@/lib/relatorios-inteligentes', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/relatorios-inteligentes')>()
  return {
    ...actual,
    buscarProcessoCompletoParaRelatorio: mockBuscarProcesso,
    buscarAndamentosParaRelatorio: mockBuscarAndamentos,
    gerarRelatorioInteligenteDraft: mockGerarDraft,
    mapRelatorioDbRowToDraft: mockMapRelatorio,
    registrarLogRelatorio: mockRegistrarLog,
  }
})

import { GET, POST } from './route'

const PROCESSO_UUID = '550e8400-e29b-41d4-a716-446655440010'
const RELATORIO_UUID = '550e8400-e29b-41d4-a716-446655440020'

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(async () => result),
    then: (resolve: (value: { data: unknown; error: unknown }) => void, reject?: (error: unknown) => void) => Promise.resolve(result).then(resolve, reject),
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/processos/[id]/relatorios', () => {
  it('bloqueia perfis sem acesso', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await GET(new Request(`http://localhost/api/processos/${PROCESSO_UUID}/relatorios`), {
      params: Promise.resolve({ id: PROCESSO_UUID }),
    } as any)

    expect(res.status).toBe(403)
  })

  it('retorna relatórios do processo', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })
    mockMapRelatorio.mockImplementation(row => ({
      id: row.id,
      titulo: row.titulo,
      status: row.status,
      processo_id: row.processo_id,
      cliente_id: row.cliente_id,
      resumo_executivo: row.resumo_executivo ?? '',
      conteudo: row.conteudo ?? {},
      conteudo_texto: row.conteudo_texto ?? '',
      periodo_inicio: row.periodo_inicio ?? null,
      periodo_fim: row.periodo_fim ?? null,
      gerado_por: row.gerado_por,
      aprovado_por: row.aprovado_por ?? null,
      publicado_por: row.publicado_por ?? null,
      created_at: row.created_at,
      approved_at: row.approved_at ?? null,
      published_at: row.published_at ?? null,
      updated_at: row.updated_at,
    }))
    mockCreateClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'client_reports') {
          return makeChain({
            data: [{
              id: RELATORIO_UUID,
              cliente_id: 'cli-1',
              processo_id: PROCESSO_UUID,
              titulo: 'Relatório 1',
              periodo_inicio: '2026-06-01',
              periodo_fim: '2026-06-30',
              resumo_executivo: 'Resumo',
              conteudo: {
                resumoExecutivo: 'Resumo',
                principaisMovimentacoes: ['Mov 1'],
                situacaoAtual: 'Situação',
                oQueIssoSignifica: 'Significado',
                proximosPassos: ['Passo 1'],
                providenciasCliente: 'Nenhuma providência é necessária neste momento.',
              },
              conteudo_texto: 'Texto',
              status: 'rascunho',
              gerado_por: 'uid',
              aprovado_por: null,
              publicado_por: null,
              created_at: '2026-06-01T10:15:00Z',
              approved_at: null,
              published_at: null,
              updated_at: '2026-06-01T10:15:00Z',
            }],
            error: null,
          })
        }
        return makeChain({ data: [], error: null })
      }),
    })

    const res = await GET(new Request(`http://localhost/api/processos/${PROCESSO_UUID}/relatorios`), {
      params: Promise.resolve({ id: PROCESSO_UUID }),
    } as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({
      id: RELATORIO_UUID,
      titulo: 'Relatório 1',
      status: 'rascunho',
    })
  })
})

describe('POST /api/processos/[id]/relatorios', () => {
  it('gera rascunho e salva no banco', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })
    mockBuscarProcesso.mockResolvedValue({
      id: PROCESSO_UUID,
      cliente_id: 'cli-1',
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
      cliente: {
        id: 'cli-1',
        nome: 'Cliente Alfa',
        cpf_cnpj: '12.345.678/0001-90',
        email: 'cliente@example.com',
        telefone: '1133334444',
        celular: '11999998888',
        endereco: 'Rua A',
      },
    })
    mockBuscarAndamentos.mockResolvedValue([
      {
        id: 'and-1',
        processo_id: PROCESSO_UUID,
        data_andamento: '2026-06-01T10:15:00Z',
        tipo: 'decisao',
        titulo: 'Decisão',
        descricao: 'Texto',
        origem: 'tribunal',
        responsavel_id: null,
        criado_por: 'uid',
        created_at: '2026-06-01T10:15:00Z',
        updated_at: '2026-06-01T10:15:00Z',
      },
    ])
    mockGerarDraft.mockResolvedValue({
      titulo: 'Relatório do processo 0001234-56.2026.8.26.0100 — Todo o período',
      resumo_executivo: 'Resumo simples.',
      conteudo: {
        resumoExecutivo: 'Resumo simples.',
        principaisMovimentacoes: ['Mov 1'],
        situacaoAtual: 'Situação atual',
        oQueIssoSignifica: 'Significado',
        proximosPassos: ['Passo 1'],
        providenciasCliente: 'Nenhuma providência é necessária neste momento.',
      },
      conteudo_texto: 'Texto',
      status: 'rascunho',
    })

    const insertChain = makeChain({
      data: {
        id: RELATORIO_UUID,
        cliente_id: 'cli-1',
        processo_id: PROCESSO_UUID,
        titulo: 'Relatório salvo',
        periodo_inicio: null,
        periodo_fim: null,
        resumo_executivo: 'Resumo simples.',
        conteudo: {
          resumoExecutivo: 'Resumo simples.',
          principaisMovimentacoes: ['Mov 1'],
          situacaoAtual: 'Situação atual',
          oQueIssoSignifica: 'Significado',
          proximosPassos: ['Passo 1'],
          providenciasCliente: 'Nenhuma providência é necessária neste momento.',
        },
        conteudo_texto: 'Texto',
        status: 'rascunho',
        gerado_por: 'uid',
        aprovado_por: null,
        publicado_por: null,
        created_at: '2026-06-01T10:15:00Z',
        approved_at: null,
        published_at: null,
        updated_at: '2026-06-01T10:15:00Z',
      },
      error: null,
    })
    mockCreateClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'client_reports') return insertChain
        return makeChain({ data: [], error: null })
      }),
    })
    mockMapRelatorio.mockImplementation(row => ({
      id: row.id,
      cliente_id: row.cliente_id,
      processo_id: row.processo_id,
      titulo: row.titulo,
      periodo_inicio: row.periodo_inicio,
      periodo_fim: row.periodo_fim,
      resumo_executivo: row.resumo_executivo,
      conteudo: row.conteudo,
      conteudo_texto: row.conteudo_texto,
      status: row.status,
      gerado_por: row.gerado_por,
      aprovado_por: row.aprovado_por,
      publicado_por: row.publicado_por,
      created_at: row.created_at,
      approved_at: row.approved_at,
      published_at: row.published_at,
      updated_at: row.updated_at,
      gerado_por_profile: null,
      aprovado_por_profile: null,
      publicado_por_profile: null,
    }))

    const res = await POST(
      new Request(`http://localhost/api/processos/${PROCESSO_UUID}/relatorios`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          periodo_inicio: '2026-06-01',
          periodo_fim: '2026-06-30',
        }),
      }),
      { params: Promise.resolve({ id: PROCESSO_UUID }) } as any,
    )

    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body).toMatchObject({
      id: RELATORIO_UUID,
      status: 'rascunho',
      resumo_executivo: 'Resumo simples.',
    })
    expect(mockGerarDraft).toHaveBeenCalledTimes(1)
    expect(mockRegistrarLog).toHaveBeenCalledTimes(1)
  })
})
