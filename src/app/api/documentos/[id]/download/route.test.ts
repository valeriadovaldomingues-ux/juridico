import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard, mockCreateServiceClient } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateServiceClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: mockCreateServiceClient }))

import { GET } from './route'

beforeEach(() => {
  mockApiGuard.mockReset()
  mockCreateServiceClient.mockReset()
})

describe('GET /api/documentos/[id]/download', () => {
  it('bloqueia usuário sem permissão', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await GET(new Request('http://localhost/api/documentos/doc-1/download'), {
      params: Promise.resolve({ id: 'doc-1' }),
    } as any)

    expect(res.status).toBe(403)
  })

  it('redireciona para o signed url', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid' })
    const selectResult = {
      data: { id: 'doc-1', nome_arquivo: 'arquivo.pdf', storage_path: 'docs/arquivo.pdf' },
      error: null,
    }
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      single: vi.fn(async () => selectResult),
    }
    const createSignedUrl = vi.fn(async () => ({
      data: { signedUrl: 'https://storage.example.com/doc-1' },
      error: null,
    }))
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => chain),
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
    })

    const res = await GET(new Request('http://localhost/api/documentos/doc-1/download'), {
      params: Promise.resolve({ id: 'doc-1' }),
    } as any)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://storage.example.com/doc-1')
  })
})
