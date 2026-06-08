import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockPortalGuard, mockCreateClient } = vi.hoisted(() => ({
  mockPortalGuard: vi.fn(),
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/auth/portal-guard', () => ({ portalGuard: mockPortalGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { GET } from './route'

const PROCESSO_UUID = '550e8400-e29b-41d4-a716-446655440100'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/portal/processos/[id]/aurora-cliente/contexto', () => {
  it('bloqueia sem sessão', async () => {
    mockPortalGuard.mockResolvedValue(NextResponse.json({ error: 'Não autenticado' }, { status: 401 }))

    const res = await GET(new Request(`http://localhost/api/portal/processos/${PROCESSO_UUID}/aurora-cliente/contexto`), {
      params: Promise.resolve({ id: PROCESSO_UUID }),
    } as any)

    expect(res.status).toBe(401)
  })

  it('retorna contexto sanitizado para o cliente', async () => {
    mockPortalGuard.mockResolvedValue({ userId: 'user-1', clienteId: 'cliente-1', clienteNome: 'Cliente' })
    mockCreateClient.mockResolvedValue({
      rpc: vi.fn(async () => ({
        data: {
          cliente_id: 'cliente-1',
          processo: {
            id: PROCESSO_UUID,
            numero_processo: '0001234-56.2026.8.26.0100',
            titulo: 'Processo exemplo',
            area_direito: 'civil',
            status: 'ativo',
            fase: 'instrução',
            tribunal: 'TJSP',
            comarca: 'São Paulo',
            vara: '1ª Vara',
            classe_processual: 'Ação',
            assunto: 'Cobrança',
            data_distribuicao: '2026-06-01',
          },
          andamentos: [
            { id: 'and-1', data_andamento: '2026-06-01T10:00:00Z', tipo: 'decisao', titulo: 'Decisão', origem: 'tribunal' },
          ],
          relatorios: [],
          comunicacoes: [],
          documentos: [],
          timeline: [
            { id: 'tl-1', data: '2026-06-01T10:00:00Z', tipo: 'andamento', texto: 'Decisão', sub: 'tribunal' },
          ],
          resumo: { andamentos: 1, relatorios: 0, comunicacoes: 0, documentos: 0, timeline: 0 },
        },
        error: null,
      })),
    })

    const res = await GET(new Request(`http://localhost/api/portal/processos/${PROCESSO_UUID}/aurora-cliente/contexto`), {
      params: Promise.resolve({ id: PROCESSO_UUID }),
    } as any)

    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      processo: {
        id: PROCESSO_UUID,
        numero_processo: '0001234-56.2026.8.26.0100',
      },
      resumo: { andamentos: 1 },
    })
    expect(body.timeline).toHaveLength(1)
  })
})
