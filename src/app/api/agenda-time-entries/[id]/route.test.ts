import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard, mockCreateClient } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { DELETE, PUT } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/agenda-time-entries/11111111-1111-1111-1111-111111111111', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockApiGuard.mockReset()
  mockCreateClient.mockReset()
})

describe('PUT /api/agenda-time-entries/:id', () => {
  it('bloqueia usuario sem permissao', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await PUT(request({ descricao_atividade: 'Novo texto' }), { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) })

    expect(res.status).toBe(403)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('impede advogado de editar lançamento de outra pessoa', async () => {
    mockApiGuard.mockResolvedValue({ role: 'advogado', userId: 'uid-adv' })
    mockCreateClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: '11111111-1111-1111-1111-111111111111', criado_por: 'uid-outro' },
              error: null,
            }),
          })),
        })),
      })),
    })

    const res = await PUT(request({ descricao_atividade: 'Novo texto' }), { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) })

    expect(res.status).toBe(403)
  })

  it('atualiza o lançamento e retorna os dados salvos', async () => {
    const updateSingle = vi.fn().mockResolvedValue({
      data: {
        id: '11111111-1111-1111-1111-111111111111',
        descricao_atividade: 'Pesquisa jurídica',
      },
      error: null,
    })
    const updateChain = {
      eq: vi.fn(() => updateChain),
      select: vi.fn(() => updateChain),
      single: updateSingle,
    }
    const updateCall = vi.fn(() => updateChain)
    const selectChain = {
      select: vi.fn(() => selectChain),
      eq: vi.fn(() => selectChain),
      single: vi.fn().mockResolvedValue({
        data: {
          id: '11111111-1111-1111-1111-111111111111',
          agenda_item_id: '11111111-1111-1111-1111-111111111111',
          cliente_id: null,
          processo_id: null,
          inicio_em: '2026-05-28T09:00:00.000Z',
          fim_em: '2026-05-28T10:00:00.000Z',
          duracao_calculada_minutos: 60,
          duracao_manual_minutos: null,
          usa_duracao_manual: false,
          descricao_atividade: 'Pesquisa',
          observacoes: null,
          cobravel: true,
          valor_hora: 200,
          valor_total: 200,
          status_cobranca: 'pendente',
          criado_por: 'uid-socio',
          created_at: '2026-05-28T10:00:00.000Z',
          updated_at: '2026-05-28T10:00:00.000Z',
        },
        error: null,
      }),
    }

    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockCreateClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== 'agenda_time_entries') return selectChain
        return {
          select: vi.fn(() => selectChain),
          update: updateCall,
          delete: vi.fn(),
        }
      }),
    })

    const res = await PUT(request({
      descricao_atividade: 'Pesquisa jurídica',
      valor_hora: 200,
    }), { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.descricao_atividade).toBe('Pesquisa jurídica')
    expect(updateCall).toHaveBeenCalledWith(expect.objectContaining({
      descricao_atividade: 'Pesquisa jurídica',
      valor_hora: 200,
    }))
  })
})

describe('DELETE /api/agenda-time-entries/:id', () => {
  it('exclui o lançamento', async () => {
    const deleteChain = {
      select: vi.fn(() => deleteChain),
      eq: vi.fn(() => deleteChain),
      delete: vi.fn(() => deleteChain),
      single: vi.fn().mockResolvedValue({ data: { criado_por: 'uid-socio' }, error: null }),
    }

    mockApiGuard.mockResolvedValue({ role: 'gerente', userId: 'uid-gerente' })
    mockCreateClient.mockResolvedValue({
      from: vi.fn(() => deleteChain),
    })

    const res = await DELETE(new Request('http://localhost/api/agenda-time-entries/11111111-1111-1111-1111-111111111111', { method: 'DELETE' }), {
      params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }),
    })

    expect(res.status).toBe(204)
    expect(deleteChain.delete).toHaveBeenCalledTimes(1)
  })
})
