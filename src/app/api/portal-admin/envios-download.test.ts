/** Download dos documentos que o cliente enviou: só a equipe (menos o comercial), URL assinada curta, marca como visto. */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { criarFakeDb, type FakeDb } from '@/lib/portal-cliente/testing/fake-db'
import { CLIENTE_A, seedBasico } from '@/lib/portal-cliente/testing/seed'

const h = vi.hoisted(() => ({ fake: null as unknown as { db: unknown }, role: 'advogado' as string | null, urls: [] as { path: string; opts: unknown }[] }))
vi.mock('@/lib/portal-cliente/db', async orig => ({ ...(await orig<typeof import('@/lib/portal-cliente/db')>()), portalDb: () => h.fake.db }))
vi.mock('@/lib/auth/api-guard', () => ({
  apiGuard: async (roles: string[]) => {
    if (!h.role) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    return roles.includes(h.role) ? { role: h.role, userId: 'u0000000-0000-4000-8000-000000000009' } : NextResponse.json({ error: 'Sem permissão para esta operação' }, { status: 403 })
  },
}))

import { GET as baixar } from './envios/[id]/download/route'

const ENVIO = 'e0000000-0000-4000-8000-0000000000e1'
const PENDENTE = 'e0000000-0000-4000-8000-0000000000e2'
let f: FakeDb
const chamar = (id: string) => baixar(new Request('http://x'), { params: Promise.resolve({ id }) })

beforeEach(() => {
  h.role = 'advogado'
  h.urls = []
  f = criarFakeDb({
    ...seedBasico(),
    portal_envios: [
      { id: ENVIO, cliente_id: CLIENTE_A, nome_original: 'Contrato.pdf', storage_path: `${CLIENTE_A}/abc-Contrato.pdf`, status: 'enviado', visto_em: null },
      { id: PENDENTE, cliente_id: CLIENTE_A, nome_original: 'Meio.pdf', storage_path: `${CLIENTE_A}/def-Meio.pdf`, status: 'pendente', visto_em: null },
    ],
  })
  ;(f.db as unknown as { storage: unknown }).storage = {
    from: () => ({ createSignedUrl: async (path: string, _s: number, opts: unknown) => { h.urls.push({ path, opts }); return { data: { signedUrl: 'https://storage.example/assinada?token=1' }, error: null } } }),
  }
  h.fake = f
})

describe('GET /api/portal-admin/envios/[id]/download', () => {
  it.each(['advogado', 'socio', 'gerente', 'administrativo', 'estagiario'])('%s baixa: redireciona para a URL assinada e marca como visto', async role => {
    h.role = role
    const res = await chamar(ENVIO)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://storage.example/assinada?token=1')
    expect(h.urls[0]).toEqual({ path: `${CLIENTE_A}/abc-Contrato.pdf`, opts: { download: 'Contrato.pdf' } })
    expect(f.tabelas.portal_envios[0]).toMatchObject({ visto_por: 'u0000000-0000-4000-8000-000000000009' })
    expect(f.tabelas.portal_envios[0].visto_em).toBeTruthy()
  })

  it('comercial → 403; sem login → 401; nada é consultado', async () => {
    h.role = 'comercial'
    expect((await chamar(ENVIO)).status).toBe(403)
    h.role = null
    expect((await chamar(ENVIO)).status).toBe(401)
    expect(f.consultas).toHaveLength(0)
  })

  it('envio pendente, inexistente ou id malformado → 404', async () => {
    expect((await chamar(PENDENTE)).status).toBe(404)
    expect((await chamar('e0000000-0000-4000-8000-0000000000ff')).status).toBe(404)
    expect((await chamar('x')).status).toBe(404)
    expect(h.urls).toHaveLength(0)
  })
})
