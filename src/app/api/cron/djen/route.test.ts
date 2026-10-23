import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCreateServiceClient, mockExecutar } = vi.hoisted(() => ({
  mockCreateServiceClient: vi.fn(),
  mockExecutar: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateServiceClient,
}))

vi.mock('@/lib/monitoramento/executar-busca', () => ({
  executarBuscaMonitoramento: mockExecutar,
}))

import { GET } from './route'

function request(headers?: HeadersInit) {
  return new Request('http://localhost/api/cron/djen', { headers })
}

beforeEach(() => {
  mockCreateServiceClient.mockReset()
  mockExecutar.mockReset()
  mockCreateServiceClient.mockReturnValue({ fakeServiceClient: true })
  delete process.env.CRON_SECRET
})

describe('GET /api/cron/djen', () => {
  it('recusa sem CRON_SECRET configurado', async () => {
    const res = await GET(request({ authorization: 'Bearer qualquer' }))
    expect(res.status).toBe(401)
    expect(mockExecutar).not.toHaveBeenCalled()
  })

  it('recusa com token incorreto', async () => {
    process.env.CRON_SECRET = 'segredo'
    const res = await GET(request({ authorization: 'Bearer errado' }))
    expect(res.status).toBe(401)
    expect(mockExecutar).not.toHaveBeenCalled()
  })

  it('executa a busca DJEN com o client de service role quando o token é válido', async () => {
    process.env.CRON_SECRET = 'segredo'
    mockExecutar.mockResolvedValue({ status: 200, body: { sucesso: true } })

    const res = await GET(request({ authorization: 'Bearer segredo' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ sucesso: true })
    expect(mockExecutar).toHaveBeenCalledWith(expect.objectContaining({
      filtro: { fonte: 'djen' },
      disparadoPor: 'cron',
    }))
  })
})
