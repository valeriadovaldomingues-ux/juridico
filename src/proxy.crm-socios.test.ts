/**
 * CRM Cris e Val (/crm-socios) — acesso na camada do proxy (middleware).
 *
 * Só papel 'socio' passa. Testado com o modo restrito (KANBAN_ONLY_MODE) ligado E desligado,
 * porque 'comercial' (Luciana) é isento do modo restrito e, ainda assim, NÃO pode entrar aqui.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUser, mockQueryResult, modo } = vi.hoisted(() => ({
  mockGetUser: vi.fn<() => Promise<{ data: { user: { id: string } | null } }>>(),
  mockQueryResult: vi.fn<() => Promise<{ data: { role: string; ativo: boolean } | null; error: null }>>(),
  modo: { restrito: false },
}))

vi.mock('@/lib/kanban-only-mode', () => ({
  get KANBAN_ONLY_MODE() { return modo.restrito },
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: mockGetUser },
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: mockQueryResult,
        single: mockQueryResult,
        then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => mockQueryResult().then(ok, ko),
      }
      return chain
    },
  }),
}))

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }))

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
delete process.env.SUPABASE_SERVICE_ROLE_KEY

import { proxy } from './proxy'

const req = (path: string) => new NextRequest(`http://localhost:3000${path}`)

function asUser(role: string, ativo = true) {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-test' } } })
  mockQueryResult.mockResolvedValue({ data: { role, ativo }, error: null })
}

beforeEach(() => {
  mockGetUser.mockReset()
  mockQueryResult.mockReset()
  modo.restrito = false
})

const ROTAS = ['/crm-socios', '/crm-socios/qualquer-subrota']
const OUTROS_PAPEIS_INTERNOS = ['estagiario', 'comercial', 'administrativo', 'advogado', 'gerente']

describe.each([
  ['modo restrito DESLIGADO', false],
  ['modo restrito LIGADO', true],
])('/crm-socios — %s', (_nome, restrito) => {
  beforeEach(() => { modo.restrito = restrito })

  for (const rota of ROTAS) {
    it(`sócio entra em ${rota}`, async () => {
      asUser('socio')
      const res = await proxy(req(rota))
      expect(res.status).toBe(200)
      expect(res.headers.get('location')).toBeNull()
    })

    for (const papel of OUTROS_PAPEIS_INTERNOS) {
      it(`${papel} NÃO entra em ${rota} (redirect, nunca 200)`, async () => {
        asUser(papel)
        const res = await proxy(req(rota))
        expect(res.status).toBe(307)
        const destino = new URL(res.headers.get('location')!).pathname
        // Modo restrito manda quem não é sócio para o Kanban; sem ele, para o dashboard.
        expect(['/dashboard', '/kanban']).toContain(destino)
        expect(destino).not.toBe('/crm-socios')
      })
    }

    it(`cliente (portal) NÃO entra em ${rota}`, async () => {
      asUser('cliente')
      const res = await proxy(req(rota))
      expect(res.status).toBe(307)
      expect(new URL(res.headers.get('location')!).pathname).toBe('/portal')
    })

    it(`sócio com conta inativa NÃO entra em ${rota}`, async () => {
      asUser('socio', false)
      const res = await proxy(req(rota))
      expect(res.status).toBe(307)
    })

    it(`sem sessão → /login em ${rota}`, async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })
      const res = await proxy(req(rota))
      expect(res.status).toBe(307)
      expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
    })
  }
})

describe('/comercial (CRM da Luciana) segue exatamente como antes', () => {
  it('comercial continua entrando em /comercial', async () => {
    asUser('comercial')
    expect((await proxy(req('/comercial'))).status).toBe(200)
  })

  it('administrativo continua entrando em /comercial', async () => {
    asUser('administrativo')
    expect((await proxy(req('/comercial'))).status).toBe(200)
  })

  it('advogado continua barrado em /comercial', async () => {
    asUser('advogado')
    expect((await proxy(req('/comercial'))).status).toBe(307)
  })
})
