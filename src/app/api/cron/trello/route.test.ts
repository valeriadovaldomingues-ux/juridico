import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCreateServiceClient, mockSyncTrelloBoard } = vi.hoisted(() => ({
  mockCreateServiceClient: vi.fn(),
  mockSyncTrelloBoard: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateServiceClient,
}))

vi.mock('@/lib/trello/sync', () => ({
  syncTrelloBoard: mockSyncTrelloBoard,
}))

import { GET } from './route'

function request(headers?: HeadersInit) {
  return new Request('http://localhost/api/cron/trello', { headers })
}

function supabaseFake(options: { integration?: { id: string } | null; running?: boolean } = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'trello_integrations') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: options.integration === undefined ? { id: 'integ-1' } : options.integration,
            error: null,
          }),
        }
      }
      if (table === 'trello_sync_logs') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: options.running ? { id: 'log-em-andamento' } : null,
            error: null,
          }),
        }
      }
      throw new Error(`tabela inesperada: ${table}`)
    }),
  }
}

beforeEach(() => {
  mockCreateServiceClient.mockReset()
  mockSyncTrelloBoard.mockReset()
  mockCreateServiceClient.mockReturnValue(supabaseFake())
  delete process.env.CRON_SECRET
})

describe('GET /api/cron/trello', () => {
  it('recusa sem CRON_SECRET configurado', async () => {
    const res = await GET(request({ authorization: 'Bearer qualquer' }))
    expect(res.status).toBe(401)
    expect(mockSyncTrelloBoard).not.toHaveBeenCalled()
  })

  it('recusa com token incorreto', async () => {
    process.env.CRON_SECRET = 'segredo'
    const res = await GET(request({ authorization: 'Bearer errado' }))
    expect(res.status).toBe(401)
    expect(mockSyncTrelloBoard).not.toHaveBeenCalled()
  })

  it('retorna 404 quando não há integração configurada — estado normal antes da conexão', async () => {
    process.env.CRON_SECRET = 'segredo'
    mockCreateServiceClient.mockReturnValue(supabaseFake({ integration: null }))

    const res = await GET(request({ authorization: 'Bearer segredo' }))
    expect(res.status).toBe(404)
    expect(mockSyncTrelloBoard).not.toHaveBeenCalled()
  })

  it('não dispara nova sincronização se já houver uma em andamento', async () => {
    process.env.CRON_SECRET = 'segredo'
    mockCreateServiceClient.mockReturnValue(supabaseFake({ running: true }))

    const res = await GET(request({ authorization: 'Bearer segredo' }))
    expect(res.status).toBe(409)
    expect(mockSyncTrelloBoard).not.toHaveBeenCalled()
  })

  it('sincroniza com o client de service role e triggered_by nulo (sem usuário)', async () => {
    process.env.CRON_SECRET = 'segredo'
    const supabase = supabaseFake()
    mockCreateServiceClient.mockReturnValue(supabase)
    mockSyncTrelloBoard.mockResolvedValue({ success: true, cards_criados: 1, cards_atualizados: 2, cards_ignorados: 0 })

    const res = await GET(request({ authorization: 'Bearer segredo' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ success: true, cards_criados: 1 })
    expect(mockSyncTrelloBoard).toHaveBeenCalledWith('integ-1', null, supabase)
  })
})
