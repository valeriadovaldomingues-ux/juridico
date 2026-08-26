import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard, mockCreateClient } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { GET } from './route'

function request(url = 'http://localhost/api/kanban-tasks') {
  return new Request(url)
}

function supabaseFake() {
  const calls: Record<string, unknown> = {}
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn((field: string, value: unknown) => { calls[`eq:${field}`] = value; return builder }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn((n: number) => { calls.limit = n; return Promise.resolve({ data: [], error: null }) }),
  }
  return { from: vi.fn(() => builder), calls }
}

beforeEach(() => {
  mockApiGuard.mockReset()
  mockCreateClient.mockReset()
  mockApiGuard.mockResolvedValue({ role: 'advogado', userId: 'uid-1' })
})

describe('GET /api/kanban-tasks', () => {
  it('bloqueia sem sessão/permissão', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Não autorizado' }, { status: 401 }))
    const res = await GET(request())
    expect(res.status).toBe(401)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('por padrão busca apenas tarefas não arquivadas, com teto de segurança', async () => {
    const supabase = supabaseFake()
    mockCreateClient.mockResolvedValue(supabase)

    await GET(request())

    expect(supabase.calls['eq:arquivado']).toBe(false)
    expect(supabase.calls.limit).toBe(2000)
  })

  it('com ?arquivadas=true busca apenas as arquivadas', async () => {
    const supabase = supabaseFake()
    mockCreateClient.mockResolvedValue(supabase)

    await GET(request('http://localhost/api/kanban-tasks?arquivadas=true'))

    expect(supabase.calls['eq:arquivado']).toBe(true)
  })
})
