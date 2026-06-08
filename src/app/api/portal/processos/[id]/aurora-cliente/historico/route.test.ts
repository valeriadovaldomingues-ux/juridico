import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockPortalGuard, mockCreateClient } = vi.hoisted(() => ({
  mockPortalGuard: vi.fn(),
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/auth/portal-guard', () => ({ portalGuard: mockPortalGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { GET } from './route'

const PROCESSO_UUID = '550e8400-e29b-41d4-a716-446655440102'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/portal/processos/[id]/aurora-cliente/historico', () => {
  it('retorna histórico da conversa', async () => {
    mockPortalGuard.mockResolvedValue({ userId: 'user-1', clienteId: 'cliente-1', clienteNome: 'Cliente' })
    mockCreateClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({
                  data: [
                    {
                      id: 'conv-1',
                      cliente_id: 'cliente-1',
                      processo_id: PROCESSO_UUID,
                      pergunta: 'Pergunta',
                      resposta: 'Resposta',
                      status: 'respondida',
                      precisa_retorno_humano: false,
                      created_at: '2026-06-01T10:00:00Z',
                      created_by: 'user-1',
                      created_by_profile: null,
                    },
                  ],
                  error: null,
                })),
              })),
            })),
          })),
        })),
      })),
    })

    const res = await GET(new Request(`http://localhost/api/portal/processos/${PROCESSO_UUID}/aurora-cliente/historico`), {
      params: Promise.resolve({ id: PROCESSO_UUID }),
    } as any)

    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({
      id: 'conv-1',
      resposta: 'Resposta',
    })
  })

  it('bloqueia sem sessão', async () => {
    mockPortalGuard.mockResolvedValue(NextResponse.json({ error: 'Não autenticado' }, { status: 401 }))

    const res = await GET(new Request(`http://localhost/api/portal/processos/${PROCESSO_UUID}/aurora-cliente/historico`), {
      params: Promise.resolve({ id: PROCESSO_UUID }),
    } as any)

    expect(res.status).toBe(401)
  })
})
