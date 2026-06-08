import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import {
  createClienteContato,
  deleteClienteContato,
  getClienteContato,
  listClienteContatos,
  updateClienteContato,
} from './service'

function makeQueryResult(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => Promise.resolve(result).then(resolve),
  }
  return chain
}

beforeEach(() => {
  mockCreateClient.mockReset()
})

describe('cliente contatos service', () => {
  it('lista contatos e permite filtrar inativos', async () => {
    const query = makeQueryResult({
      data: [
        { id: 'c1', ativo: true },
        { id: 'c2', ativo: false },
      ],
      error: null,
    })
    mockCreateClient.mockResolvedValue({ from: vi.fn(() => query) })

    const all = await listClienteContatos('cli-1')
    const onlyActive = await listClienteContatos('cli-1', { includeInactive: false })

    expect(all).toHaveLength(2)
    expect(onlyActive).toHaveLength(1)
    expect(onlyActive[0]?.id).toBe('c1')
  })

  it('carrega contato por cliente e id', async () => {
    const query = makeQueryResult({
      data: { id: 'c1', cliente_id: 'cli-1', nome: 'Contato 1' },
      error: null,
    })
    mockCreateClient.mockResolvedValue({ from: vi.fn(() => query) })

    const contato = await getClienteContato('cli-1', 'c1')

    expect(contato?.id).toBe('c1')
    expect(query.eq).toHaveBeenCalledWith('cliente_id', 'cli-1')
    expect(query.eq).toHaveBeenCalledWith('id', 'c1')
  })

  it('cria contato com principal e dados normalizados', async () => {
    const query = makeQueryResult({
      data: {
        id: 'c1',
        cliente_id: 'cli-1',
        nome: 'Contato 1',
        cargo: null,
        area_responsavel: null,
        celular: null,
        email: null,
        observacoes: null,
        contato_principal: true,
        ativo: true,
        recebe_juridico: false,
        recebe_financeiro: false,
        recebe_documentos: false,
        recebe_comunicados: false,
        criado_por: 'uid',
        atualizado_por: 'uid',
      },
      error: null,
    })
    mockCreateClient.mockResolvedValue({ from: vi.fn(() => query) })

    const contato = await createClienteContato(
      'cli-1',
      { nome: '  Contato 1  ', contato_principal: true },
      'uid',
    )

    expect(contato.nome).toBe('Contato 1')
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({
      cliente_id: 'cli-1',
      nome: 'Contato 1',
      criado_por: 'uid',
      atualizado_por: 'uid',
    }))
  })

  it('atualiza contato e remove principal anterior quando necessário', async () => {
    const currentQuery = makeQueryResult({
      data: {
        id: 'c1',
        cliente_id: 'cli-1',
        nome: 'Contato 1',
        cargo: null,
        area_responsavel: null,
        celular: null,
        email: null,
        observacoes: null,
        contato_principal: false,
        ativo: true,
        recebe_juridico: false,
        recebe_financeiro: false,
        recebe_documentos: false,
        recebe_comunicados: false,
        criado_por: 'uid',
        atualizado_por: null,
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
      },
      error: null,
    })
    const principalResetQuery = makeQueryResult({
      data: null,
      error: null,
    })
    const updateQuery = makeQueryResult({
      data: {
        id: 'c1',
        cliente_id: 'cli-1',
        nome: 'Contato 1 atualizado',
        cargo: null,
        area_responsavel: null,
        celular: null,
        email: null,
        observacoes: null,
        contato_principal: true,
        ativo: true,
        recebe_juridico: false,
        recebe_financeiro: false,
        recebe_documentos: false,
        recebe_comunicados: false,
        criado_por: 'uid',
        atualizado_por: 'uid',
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
      },
      error: null,
    })
    const from = vi.fn()
      .mockImplementationOnce(() => currentQuery)
      .mockImplementationOnce(() => principalResetQuery)
      .mockImplementationOnce(() => updateQuery)
    const supabase = { from }
    mockCreateClient.mockResolvedValue(supabase)

    const contato = await updateClienteContato(
      'cli-1',
      'c1',
      { nome: 'Contato 1 atualizado', contato_principal: true },
      'uid',
    )

    expect(contato.nome).toBe('Contato 1 atualizado')
    expect(currentQuery.eq).toHaveBeenCalledWith('cliente_id', 'cli-1')
    expect(currentQuery.eq).toHaveBeenCalledWith('id', 'c1')
    expect(principalResetQuery.neq).toHaveBeenCalledWith('id', 'c1')
  })

  it('impede excluir contato principal', async () => {
    const query = makeQueryResult({
      data: {
        id: 'c1',
        cliente_id: 'cli-1',
        nome: 'Contato 1',
        contato_principal: true,
      },
      error: null,
    })
    mockCreateClient.mockResolvedValue({ from: vi.fn(() => query) })

    await expect(deleteClienteContato('cli-1', 'c1')).rejects.toMatchObject({
      code: 'principal_contact',
    })
  })
})
