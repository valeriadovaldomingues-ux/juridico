import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGravar } = vi.hoisted(() => ({ mockGravar: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({}) }))
vi.mock('@/lib/ingest/planilha-diaria', () => ({ gravarCartoes: mockGravar }))

import { POST } from './route'

const req = (corpo: unknown, token?: string) => new Request('http://localhost/api/ingest/planilha-diaria', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(corpo),
})

beforeEach(() => { mockGravar.mockReset(); vi.stubEnv('INGEST_DIARIA_SECRET', 'segredo-de-teste') })
afterEach(() => vi.unstubAllEnvs())

describe('POST /api/ingest/planilha-diaria', () => {
  it('recusa sem segredo configurado, sem token e com token errado', async () => {
    vi.stubEnv('INGEST_DIARIA_SECRET', '')
    expect((await POST(req({ itens: [] }, 'segredo-de-teste'))).status).toBe(503)
    vi.stubEnv('INGEST_DIARIA_SECRET', 'segredo-de-teste')
    expect((await POST(req({ itens: [] }))).status).toBe(401)
    expect((await POST(req({ itens: [] }, 'errado'))).status).toBe(401)
    expect(mockGravar).not.toHaveBeenCalled()
  })
  it('recusa corpo inválido e lote grande demais', async () => {
    expect((await POST(req({}, 'segredo-de-teste'))).status).toBe(400)
    expect((await POST(req({ itens: Array(201).fill({}) }, 'segredo-de-teste'))).status).toBe(400)
  })
  it('grava em modo sombra por padrão e visível só com visivel: true', async () => {
    mockGravar.mockResolvedValue({ criados: 1, duplicados: 0, revelados: 0, recusados: 0, falhas: 0, itens: [] })
    await POST(req({ itens: [{}] }, 'segredo-de-teste'))
    expect(mockGravar).toHaveBeenLastCalledWith(expect.anything(), [{}], { visivel: false })
    const res = await POST(req({ itens: [{}], visivel: true }, 'segredo-de-teste'))
    expect(mockGravar).toHaveBeenLastCalledWith(expect.anything(), [{}], { visivel: true })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ criados: 1 })
  })
})
