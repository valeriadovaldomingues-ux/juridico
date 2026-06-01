import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard, mockUploadCentralArquivos } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockUploadCentralArquivos: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/central-arquivos', () => ({
  CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES: ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'],
  uploadCentralArquivos: mockUploadCentralArquivos,
  isCentralArquivosError: (error: unknown) => Boolean(error && typeof error === 'object' && 'status' in (error as any)),
}))

import { POST } from './route'

beforeEach(() => {
  mockApiGuard.mockReset()
  mockUploadCentralArquivos.mockReset()
})

describe('POST /api/central-arquivos/upload', () => {
  it('bloqueia cliente e anon', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const form = new FormData()
    form.append('arquivos', new File([new Uint8Array([1, 2, 3])], 'a.pdf', { type: 'application/pdf' }))

    const res = await POST(new Request('http://localhost/api/central-arquivos/upload', { method: 'POST', body: form }), { params: Promise.resolve({}) } as any)

    expect(res.status).toBe(403)
    expect(mockUploadCentralArquivos).not.toHaveBeenCalled()
  })

  it('faz upload de arquivos permitidos', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })
    mockUploadCentralArquivos.mockResolvedValue([{ id: 'd1', nome_original: 'a.pdf' }])

    const form = new FormData()
    form.append('arquivos', new File([new Uint8Array([1, 2, 3])], 'a.pdf', { type: 'application/pdf' }))

    const res = await POST(new Request('http://localhost/api/central-arquivos/upload', { method: 'POST', body: form }), { params: Promise.resolve({}) } as any)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.items).toHaveLength(1)
    expect(mockUploadCentralArquivos).toHaveBeenCalledTimes(1)
  })
})
