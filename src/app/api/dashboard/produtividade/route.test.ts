import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard, mockCreateClient, mockRpc } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateClient: vi.fn(),
  mockRpc: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { GET } from './route'

function request(path: string) {
  return new Request(`http://localhost${path}`)
}

beforeEach(() => {
  mockApiGuard.mockReset()
  mockCreateClient.mockReset()
  mockRpc.mockReset()
})

describe('GET /api/dashboard/produtividade', () => {
  it('bloqueia usuário que não é sócio', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await GET(request('/api/dashboard/produtividade?inicio=2026-05-01&fim=2026-05-02') as never)

    expect(res.status).toBe(403)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('normaliza datas para ISO antes de chamar a RPC timestamptz', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockCreateClient.mockResolvedValue({ rpc: mockRpc })
    mockRpc.mockResolvedValue({
      data: [{
        profile_id: 'profile-1',
        nome: 'Sócia',
        role: 'socio',
        total: '2',
        no_prazo: '1',
        adiantado: '1',
        atrasado: '0',
        sem_prazo: '1',
      }],
      error: null,
    })

    const res = await GET(request('/api/dashboard/produtividade?inicio=2026-05-01&fim=2026-05-08') as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith('get_produtividade_colaboradores', {
      p_inicio: new Date('2026-05-01').toISOString(),
      p_fim:    new Date('2026-05-08').toISOString(),
    })
    expect(body[0].total).toBe(2)
  })
})
