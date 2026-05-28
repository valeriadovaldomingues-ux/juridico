import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard, mockCreateClient, mockDelete, mockEq } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateClient: vi.fn(),
  mockDelete: vi.fn(),
  mockEq: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { DELETE } from './route'

function request() {
  return new Request('http://localhost/api/agenda-items/item-123', { method: 'DELETE' })
}

beforeEach(() => {
  mockApiGuard.mockReset()
  mockCreateClient.mockReset()
  mockDelete.mockReset()
  mockEq.mockReset()

  mockDelete.mockReturnValue({ eq: mockEq })
  mockCreateClient.mockResolvedValue({
    from: vi.fn(() => ({ delete: mockDelete })),
  })
})

describe('DELETE /api/agenda-items/:id', () => {
  it('bloqueia usuario sem permissao', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await DELETE(request(), { params: Promise.resolve({ id: 'item-123' }) })

    expect(res.status).toBe(403)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('exclui o item e retorna 204', async () => {
    mockApiGuard.mockResolvedValue({ role: 'gerente', userId: 'uid-gerente' })
    mockEq.mockResolvedValue({ error: null })

    const res = await DELETE(request(), { params: Promise.resolve({ id: 'item-123' }) })

    expect(res.status).toBe(204)
    expect(mockCreateClient).toHaveBeenCalledTimes(1)
    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(mockEq).toHaveBeenCalledWith('id', 'item-123')
  })

  it('propaga erro do supabase', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockEq.mockResolvedValue({ error: { message: 'falha ao remover' } })

    const res = await DELETE(request(), { params: Promise.resolve({ id: 'item-123' }) })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('falha ao remover')
  })
})
