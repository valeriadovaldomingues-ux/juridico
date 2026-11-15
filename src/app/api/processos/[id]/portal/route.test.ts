/**
 * PATCH /api/processos/[id]/portal — interruptor "Ocultar do portal do cliente".
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { criarFakeDb, type FakeDb } from '@/lib/portal-cliente/testing/fake-db'
import { PROC_A1, seedBasico } from '@/lib/portal-cliente/testing/seed'

const h = vi.hoisted(() => ({ fake: null as unknown as { db: unknown }, role: 'socio' as string | null }))

vi.mock('@/lib/portal-cliente/db', async orig => ({ ...(await orig<typeof import('@/lib/portal-cliente/db')>()), portalDb: () => h.fake.db }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.fake.db }))
vi.mock('@/lib/auth/api-guard', () => ({
  apiGuard: async (roles: string[]) => {
    if (!h.role) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    return roles.includes(h.role) ? { role: h.role, userId: 'u-socio' } : NextResponse.json({ error: 'Sem permissão para esta operação' }, { status: 403 })
  },
}))

import { PATCH } from './route'

let f: FakeDb
const patch = (corpo: unknown, id = PROC_A1) =>
  PATCH(new NextRequest('http://localhost/x', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }), { params: Promise.resolve({ id }) })

beforeEach(() => {
  f = criarFakeDb({ ...seedBasico(), portal_acessos_log: [] })
  h.fake = f
  h.role = 'socio'
})

describe('PATCH /api/processos/[id]/portal', () => {
  it('sócio oculta e reexibe; fica no log de auditoria', async () => {
    expect((await patch({ ocultar_portal: true })).status).toBe(200)
    expect(f.tabelas.processos.find(p => p.id === PROC_A1)?.ocultar_portal).toBe(true)
    expect((await patch({ ocultar_portal: false })).status).toBe(200)
    expect(f.tabelas.processos.find(p => p.id === PROC_A1)?.ocultar_portal).toBe(false)
    expect(f.tabelas.portal_acessos_log.map(l => l.acao)).toEqual(['processo_ocultado', 'processo_reexibido'])
    expect(f.tabelas.portal_acessos_log[0]).toMatchObject({ processo_id: PROC_A1, usuario_id: 'u-socio' })
  })

  it.each(['administrativo', 'advogado', 'gerente', 'estagiario', 'comercial'])('%s não pode (por enquanto só o sócio): 403', async role => {
    h.role = role
    expect((await patch({ ocultar_portal: true })).status).toBe(403)
    expect(f.tabelas.processos.find(p => p.id === PROC_A1)?.ocultar_portal).toBe(false)
  })

  it('sem login → 401', async () => {
    h.role = null
    expect((await patch({ ocultar_portal: true })).status).toBe(401)
  })

  it('valida o corpo e o id', async () => {
    expect((await patch({ ocultar_portal: 'sim' })).status).toBe(400)
    expect((await patch({})).status).toBe(400)
    expect((await patch({ ocultar_portal: true }, 'nao-uuid')).status).toBe(404)
    expect((await patch({ ocultar_portal: true }, 'ffffffff-0000-4000-8000-000000000000')).status).toBe(404)
  })

  it('coluna ainda inexistente (migração pendente) → 409 com aviso, não 500', async () => {
    f.falharTabela('processos', '42703')
    const res = await patch({ ocultar_portal: true })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/ainda não foi ativado/)
  })
})
