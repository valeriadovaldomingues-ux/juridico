import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { criarFakeDb, type FakeDb } from '@/lib/portal-cliente/testing/fake-db'
import { CLIENTE_A, seedBasico } from '@/lib/portal-cliente/testing/seed'
import { criarSessao, revogarToken } from '@/lib/portal-cliente/sessao'
import { COOKIE_SESSAO, SESSAO_DURACAO_MS } from '@/lib/portal-cliente/constantes'

const h = vi.hoisted(() => ({ fake: null as unknown as { db: unknown }, cookie: undefined as string | undefined }))

vi.mock('@/lib/portal-cliente/db', async orig => ({ ...(await orig<typeof import('@/lib/portal-cliente/db')>()), portalDb: () => h.fake.db }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (nome: string) => (nome === COOKIE_SESSAO && h.cookie ? { name: nome, value: h.cookie } : undefined) }),
}))

import { getPortalSession, portalGuard } from './portal-guard'

let f: FakeDb

beforeEach(() => {
  vi.stubEnv('PORTAL_SEGREDO', 'segredo-de-teste')
  f = criarFakeDb({ ...seedBasico(), portal_acessos: [{ id: 'ac', cliente_id: CLIENTE_A, email_acesso: 'a@a.com', ativo: true }] })
  h.fake = f
  h.cookie = undefined
})

async function logar(agora = new Date()) {
  const { token } = await criarSessao(f.db, CLIENTE_A, { ip: '203.0.113.7', userAgent: 'Teste' }, agora)
  h.cookie = token
  return token
}

describe('guard de sessão do portal (cookie próprio, sem Supabase)', () => {
  it('sessão válida → { clienteId, clienteNome }', async () => {
    await logar()
    const s = await portalGuard()
    expect(s).toMatchObject({ clienteId: CLIENTE_A, clienteNome: 'Maria da Silva' })
  })

  it('sem cookie → 401', async () => {
    const r = await portalGuard()
    expect(r).toBeInstanceOf(NextResponse)
    expect((r as NextResponse).status).toBe(401)
  })

  it('cookie inventado → 401 (e o banco não é enganado por lixo)', async () => {
    h.cookie = 'x'.repeat(43)
    expect(await getPortalSession()).toBeNull()
    h.cookie = "'; drop table portal_sessoes;--"
    expect(await getPortalSession()).toBeNull()
    h.cookie = 'curto'
    expect(await getPortalSession()).toBeNull()
  })

  it('sessão expirada (12 h) → null', async () => {
    await logar(new Date(Date.now() - SESSAO_DURACAO_MS - 1000))
    expect(await getPortalSession()).toBeNull()
  })

  it('sessão ainda dentro das 12 h → vale', async () => {
    await logar(new Date(Date.now() - SESSAO_DURACAO_MS + 60_000))
    expect(await getPortalSession()).not.toBeNull()
  })

  it('sessão revogada (sair) → null', async () => {
    const token = await logar()
    await revogarToken(f.db, token)
    expect(await getPortalSession()).toBeNull()
  })

  it('acesso revogado pelo escritório derruba a sessão na hora', async () => {
    await logar()
    f.tabelas.portal_acessos[0].ativo = false
    expect(await getPortalSession()).toBeNull()
  })

  it('sem liberação em portal_acessos (modo piloto) não há sessão válida', async () => {
    await logar()
    f.tabelas.portal_acessos.length = 0
    expect(await getPortalSession()).toBeNull()
  })

  it('cliente desativado → null', async () => {
    await logar()
    f.tabelas.clientes[0].ativo = false
    expect(await getPortalSession()).toBeNull()
  })

  it('migração ausente → null (a página manda para o login, sem 500)', async () => {
    await logar()
    f.falharTabela('portal_sessoes', '42P01')
    expect(await getPortalSession()).toBeNull()
  })

  it('o token não é guardado em claro', async () => {
    const token = await logar()
    expect(JSON.stringify(f.tabelas.portal_sessoes)).not.toContain(token)
  })
})
