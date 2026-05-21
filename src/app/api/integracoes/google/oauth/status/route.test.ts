import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard, mockCreateClient, mockGetActiveGoogleConnection } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateClient: vi.fn(),
  mockGetActiveGoogleConnection: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('@/lib/google/connections', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/google/connections')>()
  return {
    ...original,
    getActiveGoogleConnection: mockGetActiveGoogleConnection,
  }
})

import { GET } from './route'

beforeEach(() => {
  mockApiGuard.mockReset()
  mockCreateClient.mockReset()
  mockGetActiveGoogleConnection.mockReset()
})

describe('GET /api/integracoes/google/oauth/status', () => {
  it('bloqueia usuário que não é sócio', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await GET()

    expect(res.status).toBe(403)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('retorna status conectado sem expor tokens', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockCreateClient.mockResolvedValue({})
    mockGetActiveGoogleConnection.mockResolvedValue({
      id: 'conn-1',
      user_id: 'uid-socio',
      provider: 'google',
      google_email: 'socia@example.com',
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      access_token_encrypted: 'token-cifrado',
      refresh_token_encrypted: 'refresh-cifrado',
      token_expires_at: '2026-05-21T12:00:00Z',
      status: 'active',
      created_at: '2026-05-21T10:00:00Z',
      updated_at: '2026-05-21T10:00:00Z',
      revoked_at: null,
    })

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.connected).toBe(true)
    expect(body.connection.google_email).toBe('socia@example.com')
    expect(JSON.stringify(body)).not.toContain('token-cifrado')
    expect(JSON.stringify(body)).not.toContain('refresh-cifrado')
  })
})
