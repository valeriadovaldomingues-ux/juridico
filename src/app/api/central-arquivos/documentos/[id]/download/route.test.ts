import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard, mockGetDocumentoDownload } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockGetDocumentoDownload: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/central-arquivos', () => ({
  CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES: ['socio'],
  getDocumentoDownload: mockGetDocumentoDownload,
  isCentralArquivosError: (error: unknown) => Boolean(error && typeof error === 'object' && 'status' in (error as any)),
}))

import { GET } from './route'

beforeEach(() => {
  mockApiGuard.mockReset()
  mockGetDocumentoDownload.mockReset()
})

describe('GET /api/central-arquivos/documentos/[id]/download', () => {
  it('bloqueia cliente e anon', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await GET(new Request('http://localhost/api/central-arquivos/documentos/doc-1/download'), {
      params: Promise.resolve({ id: 'doc-1' }),
    } as any)

    expect(res.status).toBe(403)
    expect(mockGetDocumentoDownload).not.toHaveBeenCalled()
  })

  it('redireciona para url assinada', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })
    mockGetDocumentoDownload.mockResolvedValue({
      signedUrl: 'https://storage.example.com/doc-1',
      fileName: 'doc-1.pdf',
      mimeType: 'application/pdf',
    })

    const res = await GET(new Request('http://localhost/api/central-arquivos/documentos/doc-1/download'), {
      params: Promise.resolve({ id: 'doc-1' }),
    } as any)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://storage.example.com/doc-1')
  })
})
