/**
 * Tests for src/proxy.ts
 *
 * Strategy: mock @supabase/ssr entirely. Every test controls exactly what
 * auth.getUser() and the profiles query return, then asserts on the
 * redirect destination (Location header) or pass-through (status 200).
 *
 * Assertions:
 *   redirect  → status 307, Location header = expected URL
 *   pass-thru → status 200, no Location header
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mock setup ─────────────────────────────────────────────────────────────────
// vi.hoisted() runs before vi.mock(), so these refs are available inside the
// factory and can be configured per-test.

const { mockGetUser, mockSingle } = vi.hoisted(() => ({
  mockGetUser: vi.fn<[], Promise<{ data: { user: { id: string } | null } }>>(),
  mockSingle:  vi.fn<[], Promise<{ data: { role: string; ativo: boolean } | null; error: null }>>(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: mockGetUser },
    from: () => {
      // Fluent query chain — every method except .single() returns itself
      const chain: {
        select: (_: string) => typeof chain
        eq:     (_: string, __: unknown) => typeof chain
        single: typeof mockSingle
      } = {
        select: () => chain,
        eq:     () => chain,
        single: mockSingle,
      }
      return chain
    },
  }),
}))

// ── Stub env (ignored by mock, but avoids TS ! assertion warnings) ─────────────
process.env.NEXT_PUBLIC_SUPABASE_URL      = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

import { proxy } from './proxy'

// ── Helpers ────────────────────────────────────────────────────────────────────

const BASE = 'http://localhost:3000'

/** Create a plain GET NextRequest for the given path */
function req(pathname: string): NextRequest {
  return new NextRequest(`${BASE}${pathname}`)
}

/** Extract Location header from response */
function location(res: Response): string | null {
  return res.headers.get('location')
}

/** Assert response is a redirect and return its destination */
function expectRedirect(res: Response, expectedPath: string) {
  expect(res.status, 'should be a 307 redirect').toBe(307)
  const loc = location(res)
  expect(loc, 'Location header should be set').toBeTruthy()
  const dest = new URL(loc!)
  expect(dest.pathname, 'redirect pathname').toBe(expectedPath)
  return dest
}

/** Assert response passes through (no redirect) */
function expectPassThru(res: Response) {
  expect(res.status, 'should pass through with status 200').toBe(200)
  expect(location(res), 'should not have Location header').toBeNull()
}

// Mock presets
function noSession() {
  mockGetUser.mockResolvedValue({ data: { user: null } })
}

function asUser(role: string, ativo = true) {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-test' } } })
  mockSingle.mockResolvedValue({ data: { role, ativo }, error: null })
}

function asUserNoProfile() {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-test' } } })
  mockSingle.mockResolvedValue({ data: null, error: null })
}

// ── Reset mocks before every test ─────────────────────────────────────────────

beforeEach(() => {
  mockGetUser.mockReset()
  mockSingle.mockReset()
})

// ══════════════════════════════════════════════════════════════════════════════
// 1. USUÁRIO SEM SESSÃO
// ══════════════════════════════════════════════════════════════════════════════

describe('sem sessão', () => {
  it('acesso a rota interna → redirect para /login com ?next=', async () => {
    noSession()
    const res = await proxy(req('/dashboard'))
    const dest = expectRedirect(res, '/login')
    expect(dest.searchParams.get('next')).toBe('/dashboard')
  })

  it('acesso a /clientes → redirect para /login com ?next=', async () => {
    noSession()
    const res = await proxy(req('/clientes'))
    const dest = expectRedirect(res, '/login')
    expect(dest.searchParams.get('next')).toBe('/clientes')
  })

  it('acesso a /processos/abc-123 → redirect para /login com ?next= completo', async () => {
    noSession()
    const res = await proxy(req('/processos/abc-123'))
    const dest = expectRedirect(res, '/login')
    expect(dest.searchParams.get('next')).toBe('/processos/abc-123')
  })

  it('acesso a /portal → redirect para /portal/login com ?next=', async () => {
    noSession()
    const res = await proxy(req('/portal'))
    const dest = expectRedirect(res, '/portal/login')
    expect(dest.searchParams.get('next')).toBe('/portal')
  })

  it('acesso a /portal/processos → redirect para /portal/login com ?next=', async () => {
    noSession()
    const res = await proxy(req('/portal/processos'))
    const dest = expectRedirect(res, '/portal/login')
    expect(dest.searchParams.get('next')).toBe('/portal/processos')
  })

  it('acesso à raiz "/" → redirect para /login SEM ?next= (evita loop)', async () => {
    noSession()
    const res = await proxy(req('/'))
    const dest = expectRedirect(res, '/login')
    // Raiz não preserva ?next para evitar redirect loop pós-login
    expect(dest.searchParams.get('next')).toBeNull()
  })

  it('/login → passa através (rota pública)', async () => {
    noSession()
    const res = await proxy(req('/login'))
    expectPassThru(res)
  })

  it('/portal/login → passa através (rota pública)', async () => {
    noSession()
    const res = await proxy(req('/portal/login'))
    expectPassThru(res)
  })

  it('/auth/callback → passa através (rota pública OAuth)', async () => {
    noSession()
    const res = await proxy(req('/auth/callback'))
    expectPassThru(res)
  })

  it('/reset-password → passa através (rota pública)', async () => {
    noSession()
    const res = await proxy(req('/reset-password'))
    expectPassThru(res)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 2. USUÁRIO AUTENTICADO NO LOGIN DO ESCRITÓRIO
// ══════════════════════════════════════════════════════════════════════════════

describe('staff autenticado em /login', () => {
  it('qualquer role em /login → redirect para /dashboard', async () => {
    // /login não é isInternalPath nem isPortalPath — não consulta o DB
    // Apenas o check "user && isAuthPage" dispara
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-test' } } })
    const res = await proxy(req('/login'))
    expectRedirect(res, '/dashboard')
    // Não deve ter consultado profiles (a verificação é feita antes do bloco 3)
    expect(mockSingle).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 3. ROLE 'cliente' — BLOQUEIO DE ROTAS INTERNAS
// ══════════════════════════════════════════════════════════════════════════════

describe("role 'cliente' acessando rotas internas", () => {
  it('/dashboard → redirect para /portal', async () => {
    asUser('cliente')
    const res = await proxy(req('/dashboard'))
    expectRedirect(res, '/portal')
  })

  it('/clientes → redirect para /portal', async () => {
    asUser('cliente')
    const res = await proxy(req('/clientes'))
    expectRedirect(res, '/portal')
  })

  it('/processos → redirect para /portal', async () => {
    asUser('cliente')
    const res = await proxy(req('/processos'))
    expectRedirect(res, '/portal')
  })

  it('/kanban → redirect para /portal', async () => {
    asUser('cliente')
    const res = await proxy(req('/kanban'))
    expectRedirect(res, '/portal')
  })

  it('/financeiro → redirect para /portal (3a dispara antes de 3d)', async () => {
    // Garante que o bloqueio de cliente (3a) tem prioridade sobre o check
    // de role insuficiente (3d), mesmo em rotas restritas
    asUser('cliente')
    const res = await proxy(req('/financeiro'))
    expectRedirect(res, '/portal')
  })

  it('/configuracoes → redirect para /portal (não /dashboard)', async () => {
    asUser('cliente')
    const res = await proxy(req('/configuracoes'))
    expectRedirect(res, '/portal')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 4. ROLE 'cliente' — ACESSO AO PORTAL
// ══════════════════════════════════════════════════════════════════════════════

describe("role 'cliente' acessando /portal", () => {
  it('/portal → passa através (cliente tem acesso)', async () => {
    asUser('cliente')
    const res = await proxy(req('/portal'))
    expectPassThru(res)
  })

  it('/portal/processos → passa através', async () => {
    asUser('cliente')
    const res = await proxy(req('/portal/processos'))
    expectPassThru(res)
  })

  it('/portal/mensagens → passa através', async () => {
    asUser('cliente')
    const res = await proxy(req('/portal/mensagens'))
    expectPassThru(res)
  })

  it('/portal/login com cliente autenticado → redirect para /portal (evita re-login)', async () => {
    asUser('cliente')
    const res = await proxy(req('/portal/login'))
    expectRedirect(res, '/portal')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 5. STAFF ACESSANDO /portal
// ══════════════════════════════════════════════════════════════════════════════

describe('staff acessando rotas do portal', () => {
  it('advogado em /portal → redirect para /dashboard', async () => {
    asUser('advogado')
    const res = await proxy(req('/portal'))
    expectRedirect(res, '/dashboard')
  })

  it('socio em /portal → redirect para /dashboard', async () => {
    asUser('socio')
    const res = await proxy(req('/portal'))
    expectRedirect(res, '/dashboard')
  })

  it('gerente em /portal/processos → redirect para /dashboard', async () => {
    asUser('gerente')
    const res = await proxy(req('/portal/processos'))
    expectRedirect(res, '/dashboard')
  })

  it('staff em /portal/login → passa através (login é rota pública)', async () => {
    // /portal/login tem isPortalLogin=true; a condição 3c exige !isPortalLogin
    // então staff não é redirecionado do login do portal
    asUser('advogado')
    const res = await proxy(req('/portal/login'))
    expectPassThru(res)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 6. USUÁRIO SEM PROFILE
// ══════════════════════════════════════════════════════════════════════════════

describe('usuário autenticado sem profile (sessão órfã)', () => {
  // Após o hardening: sessão órfã em qualquer rota interna/portal → redirect login.
  // Fail-secure: nunca concede acesso sem profile válido.

  it('rota interna /dashboard → redirect para /login (sessão órfã)', async () => {
    asUserNoProfile()
    const res = await proxy(req('/dashboard'))
    const dest = expectRedirect(res, '/login')
    expect(dest.searchParams.get('erro')).toBe('sessao-invalida')
  })

  it('rota interna /clientes → redirect para /login', async () => {
    asUserNoProfile()
    const res = await proxy(req('/clientes'))
    expectRedirect(res, '/login')
  })

  it('rota sensível /financeiro → redirect para /login (sessão órfã, não /dashboard)', async () => {
    // O check de sessão órfã (3-orphan) dispara ANTES do check de role insuficiente (3d)
    asUserNoProfile()
    const res = await proxy(req('/financeiro'))
    const dest = expectRedirect(res, '/login')
    expect(dest.searchParams.get('erro')).toBe('sessao-invalida')
  })

  it('/portal → redirect para /portal/login (sessão órfã no portal)', async () => {
    asUserNoProfile()
    const res = await proxy(req('/portal'))
    const dest = expectRedirect(res, '/portal/login')
    expect(dest.searchParams.get('erro')).toBe('sessao-invalida')
  })

  it('/portal/processos → redirect para /portal/login', async () => {
    asUserNoProfile()
    const res = await proxy(req('/portal/processos'))
    expectRedirect(res, '/portal/login')
  })

  it('/portal/login com sessão órfã → passa através (sem redirect loop)', async () => {
    // Bug anterior: 3-orphan redirecionava /portal/login → /portal/login (loop infinito).
    // Fix: isPortalLogin é excluído da condição de sessão órfã.
    // Comportamento correto: orphan em /portal/login vê o formulário normalmente.
    // Sem redirect, sem loop. O usuário pode submeter o OTP.
    asUserNoProfile()
    const res = await proxy(req('/portal/login'))
    expectPassThru(res)
  })

  it('/portal/login com sessão órfã não tem header Location', async () => {
    asUserNoProfile()
    const res = await proxy(req('/portal/login'))
    expect(location(res)).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 7. USUÁRIO INATIVO
// ══════════════════════════════════════════════════════════════════════════════

describe('usuário inativo (ativo = false)', () => {
  it('rota sensível /financeiro → redirect para /dashboard (!ativo)', async () => {
    asUser('socio', false) // socio teria acesso se ativo
    const res = await proxy(req('/financeiro'))
    expectRedirect(res, '/dashboard')
  })

  it('rota sensível /configuracoes → redirect para /dashboard', async () => {
    asUser('socio', false)
    const res = await proxy(req('/configuracoes'))
    expectRedirect(res, '/dashboard')
  })

  it('rota não-sensível /dashboard → passa através (ativo só verificado em rotas sensíveis)', async () => {
    // Comportamento documentado: o layout captura o usuário inativo em /dashboard
    // e faz signOut(). O proxy deliberadamente não verifica ativo em rotas não-sensíveis
    // para minimizar consultas ao banco por request.
    asUser('advogado', false)
    const res = await proxy(req('/dashboard'))
    expectPassThru(res)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 8. ROLE INSUFICIENTE PARA ROTA RESTRITA
// ══════════════════════════════════════════════════════════════════════════════

describe('role insuficiente para rota restrita', () => {
  it('advogado em /financeiro (requer socio) → redirect para /dashboard', async () => {
    asUser('advogado')
    const res = await proxy(req('/financeiro'))
    expectRedirect(res, '/dashboard')
  })

  it('gerente em /financeiro (requer socio) → redirect para /dashboard', async () => {
    asUser('gerente')
    const res = await proxy(req('/financeiro'))
    expectRedirect(res, '/dashboard')
  })

  it('socio em /financeiro → passa através', async () => {
    asUser('socio')
    const res = await proxy(req('/financeiro'))
    expectPassThru(res)
  })

  it('advogado em /automacoes (requer gerente ou socio) → redirect para /dashboard', async () => {
    asUser('advogado')
    const res = await proxy(req('/automacoes'))
    expectRedirect(res, '/dashboard')
  })

  it('gerente em /automacoes → passa através', async () => {
    asUser('gerente')
    const res = await proxy(req('/automacoes'))
    expectPassThru(res)
  })

  it('advogado em /configuracoes/usuarios (requer gerente ou socio) → redirect', async () => {
    asUser('advogado')
    const res = await proxy(req('/configuracoes/usuarios'))
    expectRedirect(res, '/dashboard')
  })

  it('gerente em /configuracoes/usuarios → passa através', async () => {
    asUser('gerente')
    const res = await proxy(req('/configuracoes/usuarios'))
    expectPassThru(res)
  })

  it('gerente em /configuracoes (requer socio) → redirect para /dashboard', async () => {
    asUser('gerente')
    const res = await proxy(req('/configuracoes'))
    expectRedirect(res, '/dashboard')
  })

  it('socio em /configuracoes → passa através', async () => {
    asUser('socio')
    const res = await proxy(req('/configuracoes'))
    expectPassThru(res)
  })

  it('gerente em /integracoes/trello → passa através', async () => {
    asUser('gerente')
    const res = await proxy(req('/integracoes/trello'))
    expectPassThru(res)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 9. PREVENÇÃO DE REDIRECT LOOPS
// ══════════════════════════════════════════════════════════════════════════════

describe('prevenção de redirect loops', () => {
  it('cliente em /portal → passa através (não cria loop com /portal)', async () => {
    // /portal não é isInternalPath → bloco 3a não dispara
    // /portal não é isPortalLogin → bloco 3b não dispara
    // role === 'cliente' → bloco 3c não dispara
    // Resultado: passa através, sem redirect, sem loop
    asUser('cliente')
    const res = await proxy(req('/portal'))
    expectPassThru(res)
  })

  it('cliente em /portal/login → redireciona para /portal (sem loop: /portal passa através)', async () => {
    // 3b dispara: cliente + isPortalLogin → redirect /portal
    // Se /portal fosse visitado em seguida, passaria através (sem loop)
    asUser('cliente')
    const res = await proxy(req('/portal/login'))
    expectRedirect(res, '/portal')
    // Simula segundo request: cliente em /portal — passa através
    const res2 = await proxy(req('/portal'))
    expectPassThru(res2)
  })

  it('staff em /portal → redirect /dashboard; /dashboard passa através (sem loop)', async () => {
    asUser('advogado')
    const res = await proxy(req('/portal'))
    expectRedirect(res, '/dashboard')
    // Simula segundo request: staff em /dashboard — passa através
    const res2 = await proxy(req('/dashboard'))
    expectPassThru(res2)
  })

  it('staff autenticado em /login → redirect /dashboard (não retorna a /login)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-test' } } })
    const res = await proxy(req('/login'))
    // Destino é /dashboard, não /login novamente
    const dest = expectRedirect(res, '/dashboard')
    expect(dest.pathname).not.toBe('/login')
    expect(mockSingle).not.toHaveBeenCalled() // DB não consultado para /login
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 10. PRESERVAÇÃO DO PARÂMETRO ?next
// ══════════════════════════════════════════════════════════════════════════════

describe('preservação do parâmetro ?next', () => {
  it('unauthenticated em /processos → next=/processos', async () => {
    noSession()
    const res = await proxy(req('/processos'))
    const dest = expectRedirect(res, '/login')
    expect(dest.searchParams.get('next')).toBe('/processos')
  })

  it('unauthenticated em /processos/abc-123 → next=/processos/abc-123', async () => {
    noSession()
    const res = await proxy(req('/processos/abc-123'))
    const dest = expectRedirect(res, '/login')
    expect(dest.searchParams.get('next')).toBe('/processos/abc-123')
  })

  it('unauthenticated em /portal/agenda → next=/portal/agenda (login do portal)', async () => {
    noSession()
    const res = await proxy(req('/portal/agenda'))
    const dest = expectRedirect(res, '/portal/login')
    expect(dest.searchParams.get('next')).toBe('/portal/agenda')
  })

  it('unauthenticated em "/" → sem ?next (evita next=/ pós-login)', async () => {
    noSession()
    const res = await proxy(req('/'))
    const dest = expectRedirect(res, '/login')
    expect(dest.searchParams.get('next')).toBeNull()
  })

  it('parâmetro ?next codifica caracteres especiais corretamente', async () => {
    noSession()
    // URL com múltiplos segmentos — verifica que o valor não é duplo-encodado
    const res = await proxy(req('/clientes/novo'))
    const dest = expectRedirect(res, '/login')
    expect(dest.searchParams.get('next')).toBe('/clientes/novo')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 11. ROTAS PÚBLICAS — SEMPRE PASSAM ATRAVÉS
// ══════════════════════════════════════════════════════════════════════════════

describe('rotas públicas (qualquer estado de sessão)', () => {
  it('/auth/callback sem sessão → passa através', async () => {
    noSession()
    expectPassThru(await proxy(req('/auth/callback')))
  })

  it('/auth/v1/callback sem sessão → passa através', async () => {
    noSession()
    expectPassThru(await proxy(req('/auth/v1/callback')))
  })

  it('/reset-password sem sessão → passa através', async () => {
    noSession()
    expectPassThru(await proxy(req('/reset-password')))
  })

  it('/reset-password/token sem sessão → passa através', async () => {
    noSession()
    expectPassThru(await proxy(req('/reset-password/token')))
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 12. DB QUERY — EFICIÊNCIA (verificar quando a query é feita)
// ══════════════════════════════════════════════════════════════════════════════

describe('chamada ao banco de dados (eficiência)', () => {
  it('path público → DB NÃO consultado', async () => {
    noSession()
    await proxy(req('/login'))
    expect(mockGetUser).toHaveBeenCalledTimes(1)
    expect(mockSingle).not.toHaveBeenCalled()
  })

  it('staff autenticado em /login → DB NÃO consultado (redireciona antes do bloco 3)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-test' } } })
    await proxy(req('/login'))
    expect(mockSingle).not.toHaveBeenCalled()
  })

  it('staff em rota interna não-sensível (/processos) → DB consultado uma vez', async () => {
    asUser('advogado')
    await proxy(req('/processos'))
    expect(mockSingle).toHaveBeenCalledTimes(1)
  })

  it('staff em rota sensível (/financeiro) → DB consultado uma vez', async () => {
    asUser('socio')
    await proxy(req('/financeiro'))
    expect(mockSingle).toHaveBeenCalledTimes(1)
  })

  it('cliente em /portal → DB consultado uma vez', async () => {
    asUser('cliente')
    await proxy(req('/portal'))
    expect(mockSingle).toHaveBeenCalledTimes(1)
  })
})
