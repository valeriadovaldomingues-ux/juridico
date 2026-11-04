import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { mockApiGuard, mockCreateClient } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))

import { POST } from './route'

const params = { params: Promise.resolve({ id: 'proc-1' }) }
const andamento = { id: 'and-1', titulo: 'Petição juntada', descricao: null, responsavel_id: null }

function requisicao(corpo: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/processos/proc-1/andamentos', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ titulo: 'Petição juntada', tipo: 'outro', ...corpo }),
  })
}

/** Banco falso: o andamento é gravado; a criação do item na Agenda pode falhar; o "desfazer" devolve `desfeito`. */
function criarBanco({ agendaFalha, desfeito = [{ id: 'and-1' }] }: { agendaFalha?: string; desfeito?: { id: string }[] } = {}) {
  const tabelas: Record<string, Record<string, unknown>> = {
    processo_andamentos: {
      insert: () => ({ select: () => ({ single: async () => ({ data: andamento, error: null }) }) }),
      delete: () => ({ eq: () => ({ select: async () => ({ data: desfeito, error: null }) }) }),
    },
    processos: {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { cliente_id: 'cli-1', titulo: 'Proc', numero_processo: '1' } }) }) }),
    },
    agenda_items: {
      insert: () => ({ select: () => ({ single: async () => (agendaFalha
        ? { data: null, error: { message: agendaFalha } }
        : { data: { id: 'item-1' }, error: null }) }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    },
    agenda_time_entries: { insert: async () => ({ error: null }) },
  }
  return {
    from: vi.fn((tabela: string) => tabelas[tabela]),
    rpc: vi.fn(async () => ({ data: [] })),
  }
}

beforeEach(() => {
  mockApiGuard.mockReset()
  mockCreateClient.mockReset()
  mockApiGuard.mockResolvedValue({ role: 'advogado', userId: 'user-1' })
})

describe('POST /api/processos/[id]/andamentos — tempo obrigatório', () => {
  it('recusa andamento sem tempo, sem tocar no banco', async () => {
    const res = await POST(requisicao({}), params)

    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/tempo gasto/i)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('recusa bloco de tempo vazio', async () => {
    const res = await POST(requisicao({ tempo: {} }), params)

    expect(res.status).toBe(400)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('recusa tempo inválido (duração zero)', async () => {
    const res = await POST(requisicao({ tempo: { duracao_minutos: 0 } }), params)

    expect(res.status).toBe(400)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('salva o andamento e lança o tempo quando a duração é informada', async () => {
    const banco = criarBanco()
    mockCreateClient.mockResolvedValue(banco)

    const res = await POST(requisicao({ tempo: { duracao_minutos: 45 } }), params)

    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ id: 'and-1', tempo_lancado: true, tempo_aviso: null })
    expect(banco.from).toHaveBeenCalledWith('agenda_time_entries')
  })

  it('desfaz o andamento quando o tempo não pôde ser lançado', async () => {
    const banco = criarBanco({ agendaFalha: 'sem permissão' })
    mockCreateClient.mockResolvedValue(banco)

    const res = await POST(requisicao({ tempo: { duracao_minutos: 45 } }), params)

    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/andamento não foi salvo/i)
  })

  it('avisa, em vez de afirmar que desfez, quando não conseguiu apagar o andamento', async () => {
    mockCreateClient.mockResolvedValue(criarBanco({ agendaFalha: 'sem permissão', desfeito: [] }))

    const res = await POST(requisicao({ tempo: { duracao_minutos: 45 } }), params)

    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ tempo_lancado: false, tempo_aviso: expect.stringMatching(/tempo não foi lançado/i) })
  })
})
