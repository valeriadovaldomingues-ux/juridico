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
  it('administrativo em /processos → redirect para /kanban', async () => {
    asUser('administrativo')
    expectRedirect(await proxy(req('/processos')), '/kanban')
  })

  it('administrativo em /dashboard → redirect para /kanban', async () => {
    asUser('administrativo')
    expectRedirect(await proxy(req('/dashboard')), '/kanban')
  })

  // 13/10/2026: advogados, gerente e estagiário têm o mesmo acesso da Débora.
  it.each(['advogado', 'gerente', 'estagiario'])('%s passa em /processos, /dashboard, /agenda e /reunioes', async (role) => {
    asUser(role)
    for (const rota of ['/processos', '/dashboard', '/agenda', '/reunioes', '/horas']) {
      expectPassThru(await proxy(req(rota)))
    }
  })

  it.each([
    ['advogado', '/documentos'], ['advogado', '/monitoramento'], ['advogado', '/ia-juridica'],
    ['gerente', '/documentos'], ['gerente', '/relatorios'], ['gerente', '/importar'], ['gerente', '/automacoes'],
    ['estagiario', '/documentos'],
  ])('%s em %s → redirect para /dashboard (fora do escopo liberado)', async (role, rota) => {
    asUser(role)
    expectRedirect(await proxy(req(rota)), '/dashboard')
  })

  it('gerente em /financeiro → redirect para /dashboard (rota só do sócio)', async () => {
    asUser('gerente')
    expectRedirect(await proxy(req('/financeiro')), '/dashboard')
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

describe('KANBAN_ONLY_MODE — comercial isento (hoje só a Luciana)', () => {
  it('comercial em /dashboard → passa através (não força /kanban)', async () => {
    asUser('comercial')
    expectPassThru(await proxy(req('/dashboard')))
  })

  it('comercial em /comercial → passa através normalmente', async () => {
    asUser('comercial')
    expectPassThru(await proxy(req('/comercial')))
  })

  it('comercial em /clientes → passa através normalmente', async () => {
    asUser('comercial')
    expectPassThru(await proxy(req('/clientes')))
  })

  it('comercial em /agenda → passa através normalmente', async () => {
    asUser('comercial')
    expectPassThru(await proxy(req('/agenda')))
  })

  it('comercial em /financeiro → redirect para /dashboard (RESTRICTED normal, não /kanban)', async () => {
    asUser('comercial')
    expectRedirect(await proxy(req('/financeiro')), '/dashboard')
  })
})

describe('KANBAN_ONLY_MODE — /inpi isento por ROTA (todo mundo vê, 22/09/2026)', () => {
  it.each(['advogado', 'gerente', 'administrativo', 'estagiario'])(
    '%s em /inpi → passa através (isenção por rota, não é sócio)',
    async (role) => {
      asUser(role)
      expectPassThru(await proxy(req('/inpi')))
    },
  )

  it('advogado em /inpi/algumacoisa → passa através (prefixo)', async () => {
    asUser('advogado')
    expectPassThru(await proxy(req('/inpi/algumacoisa')))
  })

  it('administrativo em /processos continua redirecionando pro /kanban (isenção é só do /inpi)', async () => {
    asUser('administrativo')
    expectRedirect(await proxy(req('/processos')), '/kanban')
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
