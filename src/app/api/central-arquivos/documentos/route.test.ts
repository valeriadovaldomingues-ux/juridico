import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard, mockListDocumentos } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockListDocumentos: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/central-arquivos', () => ({
  CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES: ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'],
  listDocumentos: mockListDocumentos,
  isCentralArquivosError: (error: unknown) => Boolean(error && typeof error === 'object' && 'status' in (error as any)),
}))

import { GET } from './route'

beforeEach(() => {
  mockApiGuard.mockReset()
  mockListDocumentos.mockReset()
})

describe('GET /api/central-arquivos/documentos', () => {
  it('bloqueia cliente e anon', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await GET({ nextUrl: new URL('http://localhost/api/central-arquivos/documentos') } as any)

    expect(res.status).toBe(403)
    expect(mockListDocumentos).not.toHaveBeenCalled()
  })

  it('retorna documentos filtrando por tipo e categoria', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })
    mockListDocumentos.mockResolvedValue([{ id: 'd1', nome_original: 'Contrato.pdf' }])

    const res = await GET({ nextUrl: new URL('http://localhost/api/central-arquivos/documentos?tipo=pdf&categoria=contrato') } as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(mockListDocumentos).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'pdf', categoria: 'contrato' }))
  })
})
