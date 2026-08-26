import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockApiGuard, mockCreateClient } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('@/lib/kanban-sla', () => ({
  calculateSimpleSLA: vi.fn(() => ({ sla_level: null, sla_due_at: null })),
}))

import { PATCH } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/kanban-tasks/task-1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function supabaseFake(options: { current?: Record<string, unknown> } = {}) {
  const historicoInserts: unknown[] = []
  const updates: Array<Record<string, unknown>> = []

  const taskBuilder: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: options.current ?? {
        status: 'a_fazer', responsavel_id: null, tipo: null, origem: 'manual',
        data: null, prioridade: 'media', sla_due_at: null, created_at: '2026-01-01', arquivado: false,
      },
      error: null,
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      updates.push(payload)
      return taskBuilder
    }),
  }

  return {
    from: vi.fn((table: string) => {
      if (table === 'kanban_tasks') return taskBuilder
      if (table === 'kanban_historico') {
        return { insert: vi.fn((payload: unknown) => { historicoInserts.push(payload); return Promise.resolve({ error: null }) }) }
      }
      throw new Error(`tabela inesperada: ${table}`)
    }),
    historicoInserts,
    updates,
  }
}

beforeEach(() => {
  mockApiGuard.mockReset()
  mockCreateClient.mockReset()
  mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
})

describe('PATCH /api/kanban-tasks/:id — arquivamento', () => {
  it('arquivar preenche arquivado_em/arquivado_por e registra histórico', async () => {
    const supabase = supabaseFake()
    mockCreateClient.mockResolvedValue(supabase)

    await PATCH(request({ arquivado: true }), { params: Promise.resolve({ id: 'task-1' }) })

    expect(supabase.updates[0]).toMatchObject({ arquivado: true, arquivado_por: 'uid-socio' })
    expect(supabase.updates[0].arquivado_em).toEqual(expect.any(String))
    expect(supabase.historicoInserts[0]).toMatchObject({ acao: 'arquivamento' })
  })

  it('restaurar limpa arquivado_em/arquivado_por e registra histórico', async () => {
    const supabase = supabaseFake({
      current: {
        status: 'a_fazer', responsavel_id: null, tipo: null, origem: 'manual',
        data: null, prioridade: 'media', sla_due_at: null, created_at: '2026-01-01', arquivado: true,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    await PATCH(request({ arquivado: false }), { params: Promise.resolve({ id: 'task-1' }) })

    expect(supabase.updates[0]).toMatchObject({ arquivado: false, arquivado_em: null, arquivado_por: null })
    expect(supabase.historicoInserts[0]).toMatchObject({ acao: 'restauracao' })
  })

  it('não registra histórico quando o valor de arquivado não muda', async () => {
    const supabase = supabaseFake()
    mockCreateClient.mockResolvedValue(supabase)

    await PATCH(request({ arquivado: false }), { params: Promise.resolve({ id: 'task-1' }) })

    expect(supabase.historicoInserts).toHaveLength(0)
  })
})
