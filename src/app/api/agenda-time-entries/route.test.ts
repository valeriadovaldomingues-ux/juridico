import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard, mockCreateClient } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { GET, POST } from './route'

function getRequest(path: string) {
  return new Request(`http://localhost${path}`)
}

beforeEach(() => {
  mockApiGuard.mockReset()
  mockCreateClient.mockReset()
})

describe('GET /api/agenda-time-entries', () => {
  it('bloqueia usuário sem permissão', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await GET(getRequest('/api/agenda-time-entries'))

    expect(res.status).toBe(403)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('lista lançamentos filtrando por evento, cliente e período', async () => {
    const result = { data: [{ id: 'entry-1' }], error: null }
    const chain = {
      select: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      gte: vi.fn(() => chain),
      lte: vi.fn(() => chain),
      then: vi.fn((resolve: (value: typeof result) => void) => resolve(result)),
    }
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockCreateClient.mockResolvedValue({
      from: vi.fn(() => chain),
    })
    chain.select.mockImplementation(() => chain)
    chain.order.mockImplementation(() => chain)
    chain.limit.mockImplementation(() => chain)
    chain.eq.mockImplementation(() => chain)
    chain.gte.mockImplementation(() => chain)
    chain.lte.mockImplementation(() => chain)

    const res = await GET(getRequest(
      '/api/agenda-time-entries?agenda_item_id=11111111-1111-1111-1111-111111111111&cliente_id=22222222-2222-2222-2222-222222222222&inicio=2026-05-01T00:00:00.000Z&fim=2026-05-31T23:59:59.999Z',
    ))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual([{ id: 'entry-1' }])
    expect(chain.eq).toHaveBeenCalledWith('agenda_item_id', '11111111-1111-1111-1111-111111111111')
    expect(chain.eq).toHaveBeenCalledWith('cliente_id', '22222222-2222-2222-2222-222222222222')
    expect(chain.gte).toHaveBeenCalledWith('inicio_em', '2026-05-01T00:00:00.000Z')
    expect(chain.lte).toHaveBeenCalledWith('inicio_em', '2026-05-31T23:59:59.999Z')
  })
})

describe('POST /api/agenda-time-entries', () => {
  it('rejeita usuário sem permissão', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await POST(new Request('http://localhost/api/agenda-time-entries', {
      method: 'POST',
      body: JSON.stringify({ agenda_item_id: '11111111-1111-1111-1111-111111111111', inicio_em: '2026-05-28T09:00:00-03:00' }),
    }))

    expect(res.status).toBe(403)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('cria lançamento usando o evento como fallback de cliente/processo e descrição', async () => {
    const agendaItemSingle = vi.fn().mockResolvedValue({
      data: {
        id: '11111111-1111-1111-1111-111111111111',
        titulo: 'Audiência',
        cliente_id: '22222222-2222-2222-2222-222222222222',
        processo_id: '33333333-3333-3333-3333-333333333333',
      },
      error: null,
    })
    const insertedSingle = vi.fn().mockResolvedValue({
      data: {
        id: '44444444-4444-4444-4444-444444444444',
      },
      error: null,
    })
    const agendaItemChain = {
      select: vi.fn(() => agendaItemChain),
      eq: vi.fn(() => agendaItemChain),
      single: agendaItemSingle,
    }
    const insertedChain = {
      insert: vi.fn(() => insertedChain),
      select: vi.fn(() => insertedChain),
      single: insertedSingle,
    }

    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockCreateClient.mockResolvedValue({
      from: vi.fn((table: string) => (table === 'agenda_items' ? agendaItemChain : insertedChain)),
    })

    const res = await POST(new Request('http://localhost/api/agenda-time-entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agenda_item_id: '11111111-1111-1111-1111-111111111111',
        inicio_em: '2026-05-28T09:00:00-03:00',
        fim_em: '2026-05-28T10:00:00-03:00',
        cobravel: true,
        valor_hora: 250,
      }),
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.id).toBe('44444444-4444-4444-4444-444444444444')
    expect(insertedChain.insert).toHaveBeenCalledWith(expect.objectContaining({
      agenda_item_id: '11111111-1111-1111-1111-111111111111',
      cliente_id: '22222222-2222-2222-2222-222222222222',
      processo_id: '33333333-3333-3333-3333-333333333333',
      descricao_atividade: 'Audiência',
      criado_por: 'uid-socio',
    }))
  })
})
