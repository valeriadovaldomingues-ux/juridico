import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const {
  mockApiGuard,
  mockCreateClient,
  mockGetActiveGoogleConnection,
  mockGetValidAccessToken,
  mockPreviewGmailCleanup,
} = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateClient: vi.fn(),
  mockGetActiveGoogleConnection: vi.fn(),
  mockGetValidAccessToken: vi.fn(),
  mockPreviewGmailCleanup: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('@/lib/google/connections', () => ({
  getActiveGoogleConnection: mockGetActiveGoogleConnection,
  getValidAccessToken: mockGetValidAccessToken,
}))
vi.mock('@/lib/google/gmail', () => ({
  previewGmailCleanup: mockPreviewGmailCleanup,
}))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/integracoes/google/gmail/cleanup-preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function supabaseMock() {
  const inserts: unknown[] = []
  return {
    from: vi.fn((table: string) => {
      if (table === 'google_gmail_query_logs') {
        return {
          insert: vi.fn((payload: unknown) => {
            inserts.push(payload)
            return Promise.resolve({ error: null })
          }),
        }
      }
      throw new Error(`Tabela inesperada: ${table}`)
    }),
    inserts,
  }
}

beforeEach(() => {
  mockApiGuard.mockReset()
  mockCreateClient.mockReset()
  mockGetActiveGoogleConnection.mockReset()
  mockGetValidAccessToken.mockReset()
  mockPreviewGmailCleanup.mockReset()
})

describe('POST /api/integracoes/google/gmail/cleanup-preview', () => {
  it('bloqueia usuário que não é sócio', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await POST(request({}))

    expect(res.status).toBe(403)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('retorna prévia sanitizada e limita resultados a 20 sem modificar Gmail', async () => {
    const supabase = supabaseMock()
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockCreateClient.mockResolvedValue(supabase)
    mockGetActiveGoogleConnection.mockResolvedValue({ id: 'conn-1' })
    mockGetValidAccessToken.mockResolvedValue('access-token-servidor')
    mockPreviewGmailCleanup.mockResolvedValue({
      query: 'from:[redigido] newer_than:30d',
      totalEstimado: 1,
      mensagens: [{
        id: 'msg-1',
        threadId: 'thr-1',
        from: 'newsletter@example.com',
        subject: 'Newsletter',
        date: 'Thu, 21 May 2026 10:00:00 -0300',
        snippet: 'Resumo truncado',
        labelIds: ['INBOX'],
        sugestao: 'candidata_limpeza',
        motivos: ['Possível item promocional ou informativo'],
      }],
    })

    const res = await POST(request({ maxResults: 200, comAnexos: true }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockPreviewGmailCleanup).toHaveBeenCalledWith('access-token-servidor', expect.objectContaining({
      maxResults: 20,
      comAnexos: true,
    }))
    expect(body.mensagens).toHaveLength(1)
    expect(body.aviso).toContain('Nenhum e-mail foi arquivado')
    expect(JSON.stringify(body)).not.toContain('access-token-servidor')
    expect(supabase.inserts[0]).toMatchObject({
      user_id: 'uid-socio',
      connection_id: 'conn-1',
      query_type: 'cleanup_preview',
      result_count: 1,
      selected_count: 0,
      imported_count: 0,
      status: 'sucesso',
    })
  })
})
