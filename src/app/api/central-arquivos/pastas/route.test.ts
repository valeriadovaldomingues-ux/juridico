import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard, mockListPastas, mockCreatePasta } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockListPastas: vi.fn(),
  mockCreatePasta: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/central-arquivos', () => ({
  CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES: ['socio'],
  listPastas: mockListPastas,
  createPasta: mockCreatePasta,
  isCentralArquivosError: (error: unknown) => Boolean(error && typeof error === 'object' && 'status' in (error as any)),
}))

import { GET, POST } from './route'

beforeEach(() => {
  mockApiGuard.mockReset()
  mockListPastas.mockReset()
  mockCreatePasta.mockReset()
})

describe('GET /api/central-arquivos/pastas', () => {
  it('bloqueia cliente e anon', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await GET({ nextUrl: new URL('http://localhost/api/central-arquivos/pastas') } as any)

    expect(res.status).toBe(403)
    expect(mockListPastas).not.toHaveBeenCalled()
  })

  it('retorna pastas para usuário autenticado', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })
    mockListPastas.mockResolvedValue([{ id: 'p1', nome: 'Pasta 1' }])

    const res = await GET({ nextUrl: new URL('http://localhost/api/central-arquivos/pastas?q=contrato') } as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(mockListPastas).toHaveBeenCalledWith(expect.objectContaining({ q: 'contrato' }))
  })
})

describe('POST /api/central-arquivos/pastas', () => {
  it('cria pasta para sócio', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })
    mockCreatePasta.mockResolvedValue({ id: 'p1', nome: 'Pasta 1' })

    const res = await POST(new Request('http://localhost/api/central-arquivos/pastas', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Pasta 1', visibilidade: 'interna' }),
    }), { params: Promise.resolve({}) } as any)

    expect(res.status).toBe(201)
    expect(mockCreatePasta).toHaveBeenCalledTimes(1)
  })
})
