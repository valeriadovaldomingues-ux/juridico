import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFetchOpenCards, mockCreateClient } = vi.hoisted(() => ({
  mockFetchOpenCards: vi.fn(),
  mockCreateClient: vi.fn(),
}))

vi.mock('./api', () => ({
  fetchOpenCards: mockFetchOpenCards,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

import { syncTrelloBoard } from './sync'

function cartao(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'card-1',
    name: 'Tarefa teste',
    desc: '',
    idList: 'list-tuane',
    idMembers: [] as string[],
    due: null,
    labels: [],
    closed: false,
    ...overrides,
  }
}

/** Fake mínimo do client Supabase — cobre só as tabelas tocadas pelo sync. */
function supabaseFake(opts: {
  listMappings?: Array<Record<string, unknown>>
  memberMappings?: Array<Record<string, unknown>>
}) {
  const inserts: Array<{ table: string; payload: unknown }> = []
  const updates: Array<{ table: string; payload: unknown }> = []

  return {
    inserts,
    updates,
    from: vi.fn((table: string) => {
      if (table === 'trello_sync_logs') {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null }),
          update: vi.fn((payload: unknown) => { updates.push({ table, payload }); return { eq: vi.fn().mockResolvedValue({ error: null }) } }),
        }
      }
      if (table === 'trello_integrations') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'integ-1', board_id: 'board-1', api_key: 'k', api_token: 't' },
            error: null,
          }),
        }
      }
      if (table === 'trello_list_mappings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: opts.listMappings ?? [], error: null }),
        }
      }
      if (table === 'trello_member_mappings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: opts.memberMappings ?? [], error: null }),
        }
      }
      if (table === 'kanban_tasks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn((payload: unknown) => { inserts.push({ table, payload }); return Promise.resolve({ error: null }) }),
          update: vi.fn((payload: unknown) => { updates.push({ table, payload }); return { eq: vi.fn().mockResolvedValue({ error: null }) } }),
        }
      }
      throw new Error(`tabela inesperada no teste: ${table}`)
    }),
  }
}

beforeEach(() => {
  mockFetchOpenCards.mockReset()
  mockCreateClient.mockReset()
})

describe('syncTrelloBoard — responsável: lista tem prioridade sobre membro', () => {
  it('usa o profile_id da lista quando ela representa uma pessoa, mesmo sem membro atribuído no card', async () => {
    mockFetchOpenCards.mockResolvedValue([cartao({ idList: 'list-tuane', idMembers: [] })])
    const supabase = supabaseFake({
      listMappings: [{ trello_list_id: 'list-tuane', kanban_status: 'a_fazer', profile_id: 'profile-tuane' }],
      memberMappings: [],
    })
    mockCreateClient.mockResolvedValue(supabase)

    const resultado = await syncTrelloBoard('integ-1', 'user-1')

    expect(resultado.cards_criados).toBe(1)
    expect(resultado.sem_responsavel).toBe(0)
    expect(supabase.inserts[0].payload).toMatchObject({ responsavel_id: 'profile-tuane', status: 'a_fazer' })
  })

  it('lista com pessoa vinculada ignora o membro atribuído no card (lista vence)', async () => {
    mockFetchOpenCards.mockResolvedValue([cartao({ idList: 'list-tuane', idMembers: ['member-outro'] })])
    const supabase = supabaseFake({
      listMappings: [{ trello_list_id: 'list-tuane', kanban_status: 'a_fazer', profile_id: 'profile-tuane' }],
      memberMappings: [{ trello_member_id: 'member-outro', profile_id: 'profile-outro' }],
    })
    mockCreateClient.mockResolvedValue(supabase)

    const resultado = await syncTrelloBoard('integ-1', 'user-1')

    expect(supabase.inserts[0].payload).toMatchObject({ responsavel_id: 'profile-tuane' })
    expect(resultado.sem_responsavel).toBe(0)
  })

  it('cai para o membro atribuído quando a lista não representa uma pessoa (profile_id nulo)', async () => {
    mockFetchOpenCards.mockResolvedValue([cartao({ idList: 'list-prazos', idMembers: ['member-x'] })])
    const supabase = supabaseFake({
      listMappings: [{ trello_list_id: 'list-prazos', kanban_status: 'a_fazer', profile_id: null }],
      memberMappings: [{ trello_member_id: 'member-x', profile_id: 'profile-x' }],
    })
    mockCreateClient.mockResolvedValue(supabase)

    const resultado = await syncTrelloBoard('integ-1', 'user-1')

    expect(supabase.inserts[0].payload).toMatchObject({ responsavel_id: 'profile-x' })
    expect(resultado.sem_responsavel).toBe(0)
  })

  it('sem lista-pessoa e sem membro mapeado, fica sem responsável e é contabilizado', async () => {
    mockFetchOpenCards.mockResolvedValue([cartao({ idList: 'list-prazos', idMembers: ['member-desconhecido'] })])
    const supabase = supabaseFake({
      listMappings: [{ trello_list_id: 'list-prazos', kanban_status: 'a_fazer', profile_id: null }],
      memberMappings: [],
    })
    mockCreateClient.mockResolvedValue(supabase)

    const resultado = await syncTrelloBoard('integ-1', 'user-1')

    expect(supabase.inserts[0].payload).toMatchObject({ responsavel_id: null })
    expect(resultado.sem_responsavel).toBe(1)
    expect(resultado.membros_nao_mapeados).toHaveLength(1)
  })

  it('persiste trello_list_id e trello_list_nome no card, para colunas por lista sem responsável', async () => {
    mockFetchOpenCards.mockResolvedValue([cartao({ idList: 'list-prazos-civeis', idMembers: [] })])
    const supabase = supabaseFake({
      listMappings: [{
        trello_list_id:   'list-prazos-civeis',
        trello_list_name: 'PRAZOS CÍVEIS',
        kanban_status:    'a_fazer',
        profile_id:       null,
      }],
      memberMappings: [],
    })
    mockCreateClient.mockResolvedValue(supabase)

    await syncTrelloBoard('integ-1', 'user-1')

    expect(supabase.inserts[0].payload).toMatchObject({
      responsavel_id:   null,
      trello_list_id:   'list-prazos-civeis',
      trello_list_nome: 'PRAZOS CÍVEIS',
    })
  })

  it('lista ignorada não conta como sem responsável nem entra no board', async () => {
    mockFetchOpenCards.mockResolvedValue([cartao({ idList: 'list-planilha' })])
    const supabase = supabaseFake({
      listMappings: [{ trello_list_id: 'list-planilha', kanban_status: 'ignorar', profile_id: null }],
      memberMappings: [],
    })
    mockCreateClient.mockResolvedValue(supabase)

    const resultado = await syncTrelloBoard('integ-1', 'user-1')

    expect(resultado.cards_ignorados).toBe(1)
    expect(resultado.cards_criados).toBe(0)
    expect(supabase.inserts).toHaveLength(0)
  })
})
