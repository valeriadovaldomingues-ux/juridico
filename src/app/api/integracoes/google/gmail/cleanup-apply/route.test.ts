import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { GMAIL_MODIFY_SCOPE, GMAIL_READONLY_SCOPE } from '@/lib/google/oauth'

const {
  mockApiGuard,
  mockApplyGmailCleanupAction,
  mockCreateClient,
  mockFetchGmailMessageMetadata,
  mockGetActiveGoogleConnection,
  mockGetValidAccessToken,
} = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockApplyGmailCleanupAction: vi.fn(),
  mockCreateClient: vi.fn(),
  mockFetchGmailMessageMetadata: vi.fn(),
  mockGetActiveGoogleConnection: vi.fn(),
  mockGetValidAccessToken: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('@/lib/google/connections', () => ({
  getActiveGoogleConnection: mockGetActiveGoogleConnection,
  getValidAccessToken: mockGetValidAccessToken,
}))
vi.mock('@/lib/google/gmail', () => ({
  applyGmailCleanupAction: mockApplyGmailCleanupAction,
  fetchGmailMessageMetadata: mockFetchGmailMessageMetadata,
}))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/integracoes/google/gmail/cleanup-apply', {
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

function connection(scopes = [GMAIL_READONLY_SCOPE, GMAIL_MODIFY_SCOPE]) {
  return {
    id: 'conn-1',
    scopes,
  }
}

beforeEach(() => {
  mockApiGuard.mockReset()
  mockApplyGmailCleanupAction.mockReset()
  mockCreateClient.mockReset()
  mockFetchGmailMessageMetadata.mockReset()
  mockGetActiveGoogleConnection.mockReset()
  mockGetValidAccessToken.mockReset()
})

describe('POST /api/integracoes/google/gmail/cleanup-apply', () => {
  it('bloqueia usuário que não é sócio', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await POST(request({ action: 'trash', messageIds: ['msg-1'] }))

    expect(res.status).toBe(403)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('exige gmail.modify para aplicar ações', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockCreateClient.mockResolvedValue(supabaseMock())
    mockGetActiveGoogleConnection.mockResolvedValue(connection([GMAIL_READONLY_SCOPE]))

    const res = await POST(request({ action: 'trash', messageIds: ['msg-1'] }))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.requerReconexao).toBe(true)
    expect(mockApplyGmailCleanupAction).not.toHaveBeenCalled()
  })

  it('não aplica ação sem IDs selecionados', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })

    const res = await POST(request({ action: 'trash', messageIds: [] }))

    expect(res.status).toBe(400)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('aplica ação somente nos IDs selecionados e registra log sem tokens', async () => {
    const supabase = supabaseMock()
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockCreateClient.mockResolvedValue(supabase)
    mockGetActiveGoogleConnection.mockResolvedValue(connection())
    mockGetValidAccessToken.mockResolvedValue('access-token-servidor')
    mockFetchGmailMessageMetadata.mockResolvedValue({
      id: 'msg-1',
      categoria: 'propaganda_newsletter',
      alertaAnexo: false,
    })
    mockApplyGmailCleanupAction.mockResolvedValue({
      action: 'archive',
      totalSelecionado: 1,
      totalAplicado: 1,
      falhas: [],
    })

    const res = await POST(request({
      action: 'archive',
      messageIds: ['msg-1'],
      selectedMessages: [{ id: 'msg-1', categoria: 'propaganda_newsletter', alertaAnexo: false }],
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.totalAplicado).toBe(1)
    expect(mockApplyGmailCleanupAction).toHaveBeenCalledWith('access-token-servidor', 'archive', ['msg-1'])
    expect(JSON.stringify(supabase.inserts)).not.toContain('access-token-servidor')
    expect(supabase.inserts[0]).toMatchObject({
      user_id: 'uid-socio',
      connection_id: 'conn-1',
      query_type: 'cleanup_apply',
      result_count: 1,
      selected_count: 1,
      status: 'sucesso',
    })
  })

  it('exige confirmação extra para e-mail com anexo', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockCreateClient.mockResolvedValue(supabaseMock())
    mockGetActiveGoogleConnection.mockResolvedValue(connection())
    mockGetValidAccessToken.mockResolvedValue('access-token-servidor')
    mockFetchGmailMessageMetadata.mockResolvedValue({
      id: 'msg-1',
      categoria: 'propaganda_newsletter',
      alertaAnexo: true,
    })

    const res = await POST(request({ action: 'trash', messageIds: ['msg-1'] }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.requerConfirmacaoAnexo).toBe(true)
    expect(mockApplyGmailCleanupAction).not.toHaveBeenCalled()
  })

  it('exige confirmação extra para jurídico/processual', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockCreateClient.mockResolvedValue(supabaseMock())
    mockGetActiveGoogleConnection.mockResolvedValue(connection())
    mockGetValidAccessToken.mockResolvedValue('access-token-servidor')
    mockFetchGmailMessageMetadata.mockResolvedValue({
      id: 'msg-1',
      categoria: 'juridico_processual',
      alertaAnexo: false,
    })

    const res = await POST(request({ action: 'trash', messageIds: ['msg-1'] }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.requerConfirmacaoRisco).toBe(true)
    expect(mockApplyGmailCleanupAction).not.toHaveBeenCalled()
  })
})
