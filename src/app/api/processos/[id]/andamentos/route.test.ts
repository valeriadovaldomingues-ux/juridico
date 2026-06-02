import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard, mockCreateClient } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { GET, POST } from './route'

function makeQueryResult(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    single: vi.fn(async () => result),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => Promise.resolve(result).then(resolve),
  }
  return chain
}

beforeEach(() => {
  mockApiGuard.mockReset()
  mockCreateClient.mockReset()
})

describe('processo andamentos api', () => {
  it('bloqueia perfis sem acesso', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await GET(new Request('http://localhost/api/processos/p1/andamentos'), {
      params: Promise.resolve({ id: 'p1' }),
    } as any)

    expect(res.status).toBe(403)
  })

  it('lista andamentos em ordem decrescente', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })
    const query = makeQueryResult({
      data: [
        {
          id: 'a1',
          processo_id: 'p1',
          data_andamento: '2026-06-01T10:15:00Z',
          tipo: 'decisao',
          titulo: 'Sentença',
          descricao: null,
          origem: 'tribunal',
          responsavel_id: null,
          criado_por: 'uid',
          created_at: '2026-06-01T10:15:00Z',
          updated_at: '2026-06-01T10:15:00Z',
        },
      ],
      error: null,
    })
    mockCreateClient.mockResolvedValue({ from: vi.fn(() => query) })

    const res = await GET(new Request('http://localhost/api/processos/p1/andamentos'), {
      params: Promise.resolve({ id: 'p1' }),
    } as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(query.eq).toHaveBeenCalledWith('processo_id', 'p1')
    expect(query.order).toHaveBeenCalledWith('data_andamento', { ascending: false })
  })

  it('cria andamento manual', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })
    const query = makeQueryResult({
      data: {
        id: 'a1',
        processo_id: 'p1',
        data_andamento: '2026-06-01T10:15:00.000Z',
        tipo: 'decisao',
        titulo: 'Sentença',
        descricao: 'Descrição',
        origem: 'tribunal',
        responsavel_id: 'resp',
        criado_por: 'uid',
        created_at: '2026-06-01T10:15:00Z',
        updated_at: '2026-06-01T10:15:00Z',
      },
      error: null,
    })
    mockCreateClient.mockResolvedValue({ from: vi.fn(() => query) })

    const res = await POST(
      new Request('http://localhost/api/processos/p1/andamentos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          titulo: 'Sentença',
          descricao: 'Descrição',
          tipo: 'decisao',
          origem: 'tribunal',
          responsavel_id: 'resp',
          data_andamento: '2026-06-01T10:15:00Z',
        }),
      }),
      { params: Promise.resolve({ id: 'p1' }) } as any,
    )

    expect(res.status).toBe(201)
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({
      processo_id: 'p1',
      titulo: 'Sentença',
      criado_por: 'uid',
    }))
  })

  it('permite estagiário criar apenas observação', async () => {
    mockApiGuard.mockResolvedValue({ role: 'estagiario', userId: 'uid' })

    const res = await POST(
      new Request('http://localhost/api/processos/p1/andamentos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          titulo: 'Rascunho',
          tipo: 'decisao',
          data_andamento: '2026-06-01T10:15:00Z',
        }),
      }),
      { params: Promise.resolve({ id: 'p1' }) } as any,
    )

    expect(res.status).toBe(403)
  })
})
