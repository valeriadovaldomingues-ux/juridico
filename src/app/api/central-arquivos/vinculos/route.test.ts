import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard, mockCreateVinculo } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateVinculo: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/central-arquivos', () => ({
  CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES: ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'],
  createVinculo: mockCreateVinculo,
  isCentralArquivosError: (error: unknown) => Boolean(error && typeof error === 'object' && 'status' in (error as any)),
}))

import { POST } from './route'

beforeEach(() => {
  mockApiGuard.mockReset()
  mockCreateVinculo.mockReset()
})

describe('POST /api/central-arquivos/vinculos', () => {
  it('bloqueia cliente e anon', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await POST(new Request('http://localhost/api/central-arquivos/vinculos', {
      method: 'POST',
      body: JSON.stringify({ documento_id: 'doc-1', processo_id: 'proc-1', tipo_vinculo: 'processo' }),
    }), { params: Promise.resolve({}) } as any)

    expect(res.status).toBe(403)
    expect(mockCreateVinculo).not.toHaveBeenCalled()
  })

  it('cria vínculo de processo', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })
    mockCreateVinculo.mockResolvedValue({ id: 'v1', documento_id: 'doc-1' })

    const res = await POST(new Request('http://localhost/api/central-arquivos/vinculos', {
      method: 'POST',
      body: JSON.stringify({ documento_id: 'doc-1', processo_id: 'proc-1', tipo_vinculo: 'processo' }),
    }), { params: Promise.resolve({}) } as any)

    expect(res.status).toBe(201)
    expect(mockCreateVinculo).toHaveBeenCalledTimes(1)
  })
})
