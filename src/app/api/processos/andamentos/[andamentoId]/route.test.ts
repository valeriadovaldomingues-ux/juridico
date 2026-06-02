import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard, mockCreateClient } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { DELETE, PATCH } from './route'

function makeQueryResult(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(async () => result),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => Promise.resolve(result).then(resolve),
  }
  return chain
}

beforeEach(() => {
  mockApiGuard.mockReset()
  mockCreateClient.mockReset()
})

describe('processo andamentos update/delete api', () => {
  it('bloqueia não sócio em edição', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await PATCH(new Request('http://localhost/api/processos/andamentos/a1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ titulo: 'Atualizado', data_andamento: '2026-06-01T10:15:00Z' }),
    }), {
      params: Promise.resolve({ andamentoId: 'a1' }),
    } as any)

    expect(res.status).toBe(403)
  })

  it('atualiza andamento como sócio', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })
    const query = makeQueryResult({
      data: {
        id: 'a1',
        processo_id: 'p1',
        data_andamento: '2026-06-01T10:15:00Z',
        tipo: 'decisao',
        titulo: 'Atualizado',
        descricao: null,
        origem: 'tribunal',
        responsavel_id: null,
        criado_por: 'uid',
        created_at: '2026-06-01T10:15:00Z',
        updated_at: '2026-06-01T10:15:00Z',
      },
      error: null,
    })
    mockCreateClient.mockResolvedValue({ from: vi.fn(() => query) })

    const res = await PATCH(new Request('http://localhost/api/processos/andamentos/a1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ titulo: 'Atualizado', data_andamento: '2026-06-01T10:15:00Z' }),
    }), {
      params: Promise.resolve({ andamentoId: 'a1' }),
    } as any)

    expect(res.status).toBe(200)
    expect(query.eq).toHaveBeenCalledWith('id', 'a1')
  })

  it('remove andamento como sócio', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })
    const query = makeQueryResult({
      data: null,
      error: null,
    })
    mockCreateClient.mockResolvedValue({ from: vi.fn(() => query) })

    const res = await DELETE(new Request('http://localhost/api/processos/andamentos/a1'), {
      params: Promise.resolve({ andamentoId: 'a1' }),
    } as any)

    expect(res.status).toBe(204)
    expect(query.delete).toHaveBeenCalled()
  })
})
