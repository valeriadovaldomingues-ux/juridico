import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { mockApiGuard, mockBuscar } = vi.hoisted(() => ({ mockApiGuard: vi.fn(), mockBuscar: vi.fn() }))
vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }))
vi.mock('@/lib/agenda/pauta', async orig => ({ ...(await orig<typeof import('@/lib/agenda/pauta')>()), buscarPauta: mockBuscar }))

import { GET } from './route'

const req = (qs: string) => new NextRequest(`http://localhost/api/agenda/pauta-audiencias${qs}`)

beforeEach(() => {
  mockApiGuard.mockReset(); mockBuscar.mockReset()
  mockApiGuard.mockResolvedValue({ role: 'advogado', userId: 'u1' })
  mockBuscar.mockResolvedValue([])
})

describe('GET /api/agenda/pauta-audiencias', () => {
  it('respeita a autenticação', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Não autorizado' }, { status: 401 }))
    expect((await GET(req('?de=2026-11-16&ate=2026-11-20'))).status).toBe(401)
    expect(mockBuscar).not.toHaveBeenCalled()
  })
  it('recusa período ausente, invertido ou grande demais', async () => {
    expect((await GET(req(''))).status).toBe(400)
    expect((await GET(req('?de=2026-11-20&ate=2026-11-16'))).status).toBe(400)
    expect((await GET(req('?de=2026-01-01&ate=2026-12-31'))).status).toBe(400)
    expect(mockBuscar).not.toHaveBeenCalled()
  })
  it('devolve o PDF do período', async () => {
    const res = await GET(req('?de=2026-11-16&ate=2026-11-20'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toContain('pauta-audiencias-2026-11-16-a-2026-11-20.pdf')
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-')
    expect(mockBuscar).toHaveBeenCalledWith(expect.anything(), '2026-11-16', '2026-11-20')
  })
  it('avisa em vez de quebrar quando a busca falha', async () => {
    mockBuscar.mockRejectedValue(new Error('boom'))
    expect((await GET(req('?de=2026-11-16&ate=2026-11-20'))).status).toBe(500)
  })
})
