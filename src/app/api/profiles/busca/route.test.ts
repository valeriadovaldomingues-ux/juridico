import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({
  apiGuard: mockApiGuard,
}))

import { GET } from './route'

beforeEach(() => {
  mockApiGuard.mockReset()
})

describe('GET /api/profiles/busca', () => {
  it('bloqueia usuario sem permissao', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await GET({ nextUrl: new URL('http://localhost/api/profiles/busca?q=mar') } as any)
    expect(res.status).toBe(403)
  })

  it('retorna vazio quando a busca não tem mínimo de caracteres', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })

    const res = await GET({ nextUrl: new URL('http://localhost/api/profiles/busca?q=a') } as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual([])
  })
})
