import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { mockApiGuard, mockCreateClient, inserts } = vi.hoisted(() => ({ mockApiGuard: vi.fn(), mockCreateClient: vi.fn(), inserts: [] as unknown[] }))
vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('@/lib/google/agenda-disparo', () => ({ sincronizarGoogleEmSegundoPlano: vi.fn() }))

import { POST } from './route'

const req = (corpo: Record<string, unknown>) => new NextRequest('http://localhost/api/agenda-items', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ titulo: 'Audiência', data_inicio: '2026-11-16', ...corpo }),
})

beforeEach(() => {
  inserts.length = 0
  mockApiGuard.mockResolvedValue({ role: 'advogado', userId: 'u1' })
  mockCreateClient.mockResolvedValue({ from: () => ({ insert: (v: unknown) => { inserts.push(v); return { select: () => ({ single: async () => ({ data: { id: 'x' }, error: null }) }) } } }) })
})

describe('POST /api/agenda-items', () => {
  it('recusa audiência e perícia sem processo', async () => {
    expect((await POST(req({ tipo: 'audiencia' }))).status).toBe(400)
    expect((await POST(req({ tipo: 'pericia' }))).status).toBe(400)
    expect(inserts).toHaveLength(0)
  })
  it('grava audiência com processo e campos próprios; os outros tipos não levam os campos', async () => {
    expect((await POST(req({ tipo: 'audiencia', processo_id: 'p1', audiencia_tipo: 'una', audiencia_modalidade: 'virtual', audiencia_local: 'https://zoom.us/x' }))).status).toBe(201)
    expect(inserts[0]).toMatchObject({ processo_id: 'p1', audiencia_tipo: 'una', audiencia_modalidade: 'virtual', audiencia_local: 'https://zoom.us/x' })
    await POST(req({ tipo: 'tarefa', audiencia_tipo: 'una' }))
    expect(inserts[1]).not.toHaveProperty('audiencia_tipo')
  })
})
