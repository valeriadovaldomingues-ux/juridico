import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { mockApiGuard, mockService } = vi.hoisted(() => ({ mockApiGuard: vi.fn(), mockService: vi.fn() }))
vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: mockService }))

import { DELETE, PATCH } from './route'

const ID = 'and-1'
const params = { params: Promise.resolve({ andamentoId: ID }) }
const corpo = { titulo: 'Título corrigido', tipo: 'observacao', data_andamento: '2026-11-05T12:00:00.000Z', descricao: 'ok', origem: 'manual' }
const req = (b: unknown) => new NextRequest('http://localhost/api/processos/andamentos/and-1', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })

/** Banco falso: o andamento atual, e o que foi gravado no histórico e no update. */
function dbFalso(atual: Record<string, unknown> | null, opts: { falhaHistorico?: boolean; falhaUpdate?: boolean } = {}) {
  const hist: unknown[] = []
  const updates: unknown[] = []
  const removidos: string[] = []
  const db = {
    from: (t: string) => {
      const c: Record<string, unknown> = {}
      c.select = () => c
      c.eq = (_col: string, v: string) => { if (c._del) removidos.push(`${t}:${v}`); return c._del ? Promise.resolve({ error: null }) : c }
      c.maybeSingle = async () => ({ data: atual, error: null })
      c.single = async () => {
        if (t === 'processo_andamentos_historico') return opts.falhaHistorico ? { data: null, error: { message: 'x' } } : { data: { id: 'h1' }, error: null }
        return opts.falhaUpdate ? { data: null, error: { message: 'falha' } } : { data: { id: ID, ...(updates[0] as object) }, error: null }
      }
      c.insert = (v: unknown) => { if (t === 'processo_andamentos_historico') hist.push(v); return c }
      c.update = (v: unknown) => { updates.push(v); return c }
      c.delete = () => { c._del = true; return c }
      return c
    },
  }
  return { db, hist, updates, removidos }
}

const existente = { id: ID, processo_id: 'p1', tipo: 'observacao', titulo: 'Titulo com erro', descricao: 'ok', origem: 'manual', data_andamento: '2026-11-05T12:00:00Z', responsavel_id: null }

beforeEach(() => { mockApiGuard.mockReset(); mockService.mockReset() })

describe('PATCH andamento: quem pode editar', () => {
  it('advogado edita e o antes/depois vai para o histórico', async () => {
    mockApiGuard.mockResolvedValue({ role: 'advogado', userId: 'u-adv' })
    const f = dbFalso({ ...existente, tipo: 'peticao' }); mockService.mockReturnValue(f.db)
    const res = await PATCH(req({ ...corpo, tipo: 'peticao' }), params)
    expect(res.status).toBe(200)
    expect(f.hist[0]).toMatchObject({ andamento_id: ID, processo_id: 'p1', acao: 'edicao', feito_por: 'u-adv', antes: { titulo: 'Titulo com erro' }, depois: { titulo: 'Título corrigido' } })
    expect(f.updates[0]).toMatchObject({ titulo: 'Título corrigido' })
  })
  it('estagiário edita observação, mas não outros tipos nem muda o tipo', async () => {
    mockApiGuard.mockResolvedValue({ role: 'estagiario', userId: 'u-est' })
    const ok = dbFalso(existente); mockService.mockReturnValue(ok.db)
    expect((await PATCH(req(corpo), params)).status).toBe(200)
    const outro = dbFalso({ ...existente, tipo: 'decisao' }); mockService.mockReturnValue(outro.db)
    expect((await PATCH(req(corpo), params)).status).toBe(403)
    const muda = dbFalso(existente); mockService.mockReturnValue(muda.db)
    expect((await PATCH(req({ ...corpo, tipo: 'decisao' }), params)).status).toBe(403)
    expect(outro.updates).toHaveLength(0)
    expect(muda.hist).toHaveLength(0)
  })
  it('perfis fora da lista (a barreira é do apiGuard) e andamento inexistente', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))
    expect((await PATCH(req(corpo), params)).status).toBe(403)
    mockApiGuard.mockResolvedValue({ role: 'advogado', userId: 'u' })
    mockService.mockReturnValue(dbFalso(null).db)
    expect((await PATCH(req(corpo), params)).status).toBe(404)
  })
  it('valida título e data antes de tocar no banco', async () => {
    mockApiGuard.mockResolvedValue({ role: 'advogado', userId: 'u' })
    expect((await PATCH(req({ ...corpo, titulo: ' ' }), params)).status).toBe(400)
    expect((await PATCH(req({ ...corpo, data_andamento: 'xx' }), params)).status).toBe(400)
    expect(mockService).not.toHaveBeenCalled()
  })
})

describe('PATCH andamento: histórico primeiro', () => {
  it('se o histórico falhar, não altera o andamento', async () => {
    mockApiGuard.mockResolvedValue({ role: 'advogado', userId: 'u' })
    const f = dbFalso(existente, { falhaHistorico: true }); mockService.mockReturnValue(f.db)
    expect((await PATCH(req(corpo), params)).status).toBe(500)
    expect(f.updates).toHaveLength(0)
  })
  it('se a alteração falhar, desfaz o registro do histórico', async () => {
    mockApiGuard.mockResolvedValue({ role: 'advogado', userId: 'u' })
    const f = dbFalso(existente, { falhaUpdate: true }); mockService.mockReturnValue(f.db)
    expect((await PATCH(req(corpo), params)).status).toBe(400)
    expect(f.removidos).toContain('processo_andamentos_historico:h1')
  })
})

describe('DELETE andamento', () => {
  it('só o sócio exclui, e a exclusão fica no histórico', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'u-socio' })
    const f = dbFalso(existente); mockService.mockReturnValue(f.db)
    const res = await DELETE(new NextRequest('http://localhost/x', { method: 'DELETE' }), params)
    expect(res.status).toBe(204)
    expect(f.hist[0]).toMatchObject({ acao: 'exclusao', feito_por: 'u-socio', antes: { titulo: 'Titulo com erro' } })
    expect(f.removidos).toContain(`processo_andamentos:${ID}`)
  })
})
