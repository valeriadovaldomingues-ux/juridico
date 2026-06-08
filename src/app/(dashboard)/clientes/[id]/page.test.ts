import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequireRole, mockCreateClient, mockListClienteContatos, mockCanEditClienteContatos } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockCreateClient: vi.fn(),
  mockListClienteContatos: vi.fn(),
  mockCanEditClienteContatos: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireRole: mockRequireRole }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('@/lib/cliente-contatos', () => ({
  canEditClienteContatos: mockCanEditClienteContatos,
  listClienteContatos: mockListClienteContatos,
}))
vi.mock('./ClienteDetail', () => ({ default: () => null }))
vi.mock('../ClienteForm', () => ({ default: () => null }))

import ClientePage from './page'

function makeQueryResult(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: vi.fn(() => chain),
    order: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(async () => result),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => Promise.resolve(result).then(resolve),
  }
  return chain
}

beforeEach(() => {
  mockRequireRole.mockReset()
  mockCreateClient.mockReset()
  mockListClienteContatos.mockReset()
  mockCanEditClienteContatos.mockReset()
})

describe('clientes/[id] page', () => {
  it('carrega contatos e repassa permissões ao detalhe', async () => {
    mockRequireRole.mockResolvedValue({ profile: { role: 'socio' } })
    const clienteQuery = makeQueryResult({
      data: { id: 'cli-1', nome: 'Cliente 1', tipo_pessoa: 'juridica' },
      error: null,
    })
    const processosQuery = makeQueryResult({ data: [], error: null })
    const interactionsQuery = makeQueryResult({ data: [], error: null })
    const tarefasQuery = makeQueryResult({ data: [], error: null })
    const agendaQuery = makeQueryResult({ data: [], error: null })

    const from = vi.fn((table: string) => {
      if (table === 'clientes') return clienteQuery
      if (table === 'processos') return processosQuery
      if (table === 'contact_interactions') return interactionsQuery
      if (table === 'kanban_tasks') return tarefasQuery
      if (table === 'agenda_items') return agendaQuery
      throw new Error(`Tabela inesperada: ${table}`)
    })

    mockCreateClient.mockResolvedValue({ from })
    mockListClienteContatos.mockResolvedValue([{ id: 'cont-1', nome: 'Contato 1' }])
    mockCanEditClienteContatos.mockReturnValue(true)

    const element = await ClientePage({ params: Promise.resolve({ id: 'cli-1' }) }) as any

    expect(mockRequireRole).toHaveBeenCalledWith(['estagiario', 'comercial', 'administrativo', 'advogado', 'gerente', 'socio'])
    expect(mockListClienteContatos).toHaveBeenCalledWith('cli-1')
    expect(element.props.children.props).toEqual(expect.objectContaining({
      contatos: [{ id: 'cont-1', nome: 'Contato 1' }],
      canEditContatos: true,
    }))
  })
})
