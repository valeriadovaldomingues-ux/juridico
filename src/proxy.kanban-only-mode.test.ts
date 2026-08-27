/**
 * Tests for the KANBAN_ONLY_MODE gate in src/proxy.ts.
 *
 * A suíte principal (proxy.test.ts) mocka KANBAN_ONLY_MODE=false para
 * continuar validando a matriz de permissões "normal" por role. Este
 * arquivo roda com a flag real (true) e cobre só o comportamento do modo
 * restrito temporário: qualquer perfil que não seja 'socio' só acessa
 * /kanban entre as rotas internas; 'socio' e 'cliente' não são afetados.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUser, mockQueryResult } = vi.hoisted(() => ({
  mockGetUser:     vi.fn<[], Promise<{ data: { user: { id: string; email?: string } | null } }>>(),
  mockQueryResult: vi.fn<[], Promise<{ data: { role: string; ativo: boolean } | null; error: { code: string; message: string } | null }>>(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: mockGetUser },
    from: () => {
      const chain: {
        select:      (_: string) => typeof chain
        eq:          (_: string, __: unknown) => typeof chain
        single:      typeof mockQueryResult
        maybeSingle: typeof mockQueryResult
        then:        (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise<unknown>
      } = {
        select:      () => chain,
        eq:          () => chain,
        single:      mockQueryResult,
        maybeSingle: mockQueryResult,
        then:        (onfulfilled, onrejected) => mockQueryResult().then(onfulfilled, onrejected),
      }
      return chain
    },
  }),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => {
      const chain: {
        select:      (_: string) => typeof chain
        eq:          (_: string, __: unknown) => typeof chain
        maybeSingle: typeof mockQueryResult
        then:        (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise<unknown>
      } = {
        select:      () => chain,
        eq:          () => chain,
        maybeSingle: mockQueryResult,
        then:        (onfulfilled, onrejected) => mockQueryResult().then(onfulfilled, onrejected),
      }
      return chain
    },
  }),
}))

process.env.NEXT_PUBLIC_SUPABASE_URL      = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

import { proxy } from './proxy'

const BASE = 'http://localhost:3000'

function req(pathname: string): NextRequest {
  return new NextRequest(`${BASE}${pathname}`)
}

function location(res: Response): string | null {
  return res.headers.get('location')
}

function expectRedirect(res: Response, expectedPath: string) {
  expect(res.status, 'should be a 307 redirect').toBe(307)
  const loc = location(res)
  expect(loc, 'Location header should be set').toBeTruthy()
  expect(new URL(loc!).pathname, 'redirect pathname').toBe(expectedPath)
}

function expectPassThru(res: Response) {
  expect(res.status, 'should pass through with status 200').toBe(200)
  expect(location(res), 'should not have Location header').toBeNull()
}

function asUser(role: string, ativo = true) {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-test' } } })
  mockQueryResult.mockResolvedValue({ data: { role, ativo }, error: null })
}

beforeEach(() => {
  mockGetUser.mockReset()
  mockQueryResult.mockReset()
})

describe('KANBAN_ONLY_MODE — perfis não-sócio restritos ao Kanban', () => {
  it.each(['advogado', 'gerente', 'administrativo', 'comercial', 'estagiario'])(
    '%s em /processos → redirect para /kanban',
    async (role) => {
      asUser(role)
      expectRedirect(await proxy(req('/processos')), '/kanban')
    },
  )

  it.each(['advogado', 'gerente', 'administrativo', 'comercial', 'estagiario'])(
    '%s em /dashboard → redirect para /kanban',
    async (role) => {
      asUser(role)
      expectRedirect(await proxy(req('/dashboard')), '/kanban')
    },
  )

  it('gerente em /financeiro → redirect para /kanban (não /dashboard)', async () => {
    asUser('gerente')
    expectRedirect(await proxy(req('/financeiro')), '/kanban')
  })

  it.each(['advogado', 'gerente', 'administrativo', 'comercial', 'estagiario'])(
    '%s em /kanban → passa através normalmente',
    async (role) => {
      asUser(role)
      expectPassThru(await proxy(req('/kanban')))
    },
  )

  it('advogado em /kanban/algumacoisa → passa através (prefixo)', async () => {
    asUser('advogado')
    expectPassThru(await proxy(req('/kanban/algumacoisa')))
  })
})

describe('KANBAN_ONLY_MODE — sócio e cliente não são afetados', () => {
  it('socio em /processos → passa através normalmente', async () => {
    asUser('socio')
    expectPassThru(await proxy(req('/processos')))
  })

  it('socio em /financeiro → passa através normalmente', async () => {
    asUser('socio')
    expectPassThru(await proxy(req('/financeiro')))
  })

  it('cliente em /kanban → redirect /portal (regra de cliente inalterada)', async () => {
    asUser('cliente')
    expectRedirect(await proxy(req('/kanban')), '/portal')
  })

  it('cliente em /processos → redirect /portal (regra de cliente inalterada)', async () => {
    asUser('cliente')
    expectRedirect(await proxy(req('/processos')), '/portal')
  })
})
