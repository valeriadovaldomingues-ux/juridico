import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { mockApiGuard, mockClient, mockService } = vi.hoisted(() => ({ mockApiGuard: vi.fn(), mockClient: vi.fn(), mockService: vi.fn() }))
vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockClient }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: mockService }))

import { PATCH } from './route'

const ID = '11111111-1111-1111-1111-111111111111'
const CLI = '22222222-2222-2222-2222-222222222222'
const PROC = '33333333-3333-3333-3333-333333333333'
const RESP = '44444444-4444-4444-4444-444444444444'
const params = { params: Promise.resolve({ id: ID }) }
const corpo = { descricao: 'Consultoria corrigida', data: '2026-11-17', modo: 'duracao', horas: 1, minutos: 30 }
const req = (b: unknown) => new NextRequest(`http://localhost/api/horas/lancar/${ID}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })

const atual = { id: ID, agenda_item_id: 'item-1', cliente_id: CLI, processo_id: null, criado_por: 'u-orig', valor_hora: 300, status_cobranca: 'pendente' }

function dbFalso(opts: { entrada?: unknown; processo?: unknown; perfil?: unknown } = {}) {
  const updates: [string, unknown][] = []
  const db = {
    from: (t: string) => {
      const c: Record<string, unknown> = {}
      c.select = () => c
      c.eq = () => c
      c.maybeSingle = async () => ({ data: t === 'agenda_time_entries' ? (opts.entrada === undefined ? atual : opts.entrada) : t === 'processos' ? (opts.processo ?? null) : t === 'profiles' ? (opts.perfil ?? null) : null, error: null })
      c.single = async () => ({ data: { id: ID, cliente_id: CLI }, error: null })
      c.update = (v: unknown) => { updates.push([t, v]); return c }
      return c
    },
  }
  return { db, updates }
}

beforeEach(() => { mockApiGuard.mockReset(); mockClient.mockReset(); mockService.mockReset(); mockApiGuard.mockResolvedValue({ role: 'advogado', userId: 'u-adv' }) })

describe('PATCH /api/horas/lancar/[id]', () => {
  it('advogado edita lançamento de OUTRA pessoa: grava tempo, descrição e preserva o valor/hora', async () => {
    const f = dbFalso(); mockClient.mockResolvedValue(f.db); mockService.mockReturnValue(f.db)
    const res = await PATCH(req(corpo), params)
    expect(res.status).toBe(200)
    const [, upd] = f.updates.find(u => u[0] === 'agenda_time_entries')!
    expect(upd).toMatchObject({ descricao_atividade: 'Consultoria corrigida', usa_duracao_manual: true, duracao_manual_minutos: 90, processo_id: null, criado_por: 'u-orig', valor_total: 450 })
    expect(f.updates.find(u => u[0] === 'agenda_items')![1]).toMatchObject({ data_inicio: '2026-11-17', processo_id: null })
  })
  it('troca o responsável por usuário ativo e atualiza o nome na agenda', async () => {
    const f = dbFalso({ perfil: { id: RESP, nome: 'Tuane Miranda' } }); mockClient.mockResolvedValue(f.db); mockService.mockReturnValue(f.db)
    expect((await PATCH(req({ ...corpo, responsavel_id: RESP }), params)).status).toBe(200)
    expect(f.updates.find(u => u[0] === 'agenda_time_entries')![1]).toMatchObject({ criado_por: RESP })
    expect(f.updates.find(u => u[0] === 'agenda_items')![1]).toMatchObject({ responsavel: 'Tuane Miranda' })
  })
  it('recusa processo de outro cliente', async () => {
    const f = dbFalso({ processo: { id: PROC, cliente_id: 'outro' } }); mockClient.mockResolvedValue(f.db); mockService.mockReturnValue(f.db)
    const res = await PATCH(req({ ...corpo, processo_id: PROC }), params)
    expect(res.status).toBe(400)
    expect(f.updates).toHaveLength(0)
  })
  it('valida descrição, tempo, lançamento inexistente e papel', async () => {
    const f = dbFalso(); mockClient.mockResolvedValue(f.db); mockService.mockReturnValue(f.db)
    expect((await PATCH(req({ ...corpo, descricao: ' ' }), params)).status).toBe(400)
    expect((await PATCH(req({ ...corpo, horas: 0, minutos: 0 }), params)).status).toBe(400)
    const vazio = dbFalso({ entrada: null }); mockClient.mockResolvedValue(vazio.db)
    expect((await PATCH(req(corpo), params)).status).toBe(404)
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))
    expect((await PATCH(req(corpo), params)).status).toBe(403)
  })
})
