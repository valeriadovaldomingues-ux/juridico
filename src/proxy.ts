import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rotas restritas por papel — inlined para compatibilidade com edge runtime.
// Mais específicas primeiro (ex: /configuracoes/usuarios antes de /configuracoes).
// Deve estar sincronizado com RESTRICTED_ROUTES em src/lib/permissions.ts.
const RESTRICTED: Array<{ prefix: string; roles: string[] }> = [
  { prefix: '/financeiro',             roles: ['socio'] },
  { prefix: '/automacoes',             roles: ['gerente', 'socio'] },
  { prefix: '/integracoes',            roles: ['gerente', 'socio'] },
  { prefix: '/configuracoes/usuarios', roles: ['gerente', 'socio'] },
  { prefix: '/configuracoes',          roles: ['socio'] },
]

// Prefixos de rotas internas do escritório.
// Role 'cliente' é bloqueado de todos esses caminhos e redirecionado para /portal.
const INTERNAL_PREFIXES = [
  '/dashboard', '/clientes', '/processos', '/agenda', '/kanban',
  '/publicacoes', '/documentos', '/financeiro', '/comercial', '/relatorios',
  '/importar', '/automacoes', '/monitoramento', '/ia-juridica',
  '/integracoes', '/configuracoes', '/tv',
]

function routeAllowed(role: string, pathname: string): boolean {
  for (const r of RESTRICTED) {
    if (pathname.startsWith(r.prefix)) return r.roles.includes(role)
  }
  return true
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Renova o token de sessão automaticamente (tokens expiram a cada hora)
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // ── Classificação de caminhos ───────────────────────────────────────────────

  const isPortalPath  = pathname.startsWith('/portal')
  const isPortalLogin = pathname === '/portal/login'
  const isAuthPage    = pathname === '/login'
  const isPublicPath  =
    isAuthPage       ||
    isPortalLogin    ||                           // login do portal é público
    pathname.startsWith('/auth') ||              // callbacks OAuth do Supabase
    pathname.startsWith('/reset-password')       // fluxo de reset de senha

  const isInternalPath = INTERNAL_PREFIXES.some(p => pathname.startsWith(p))
  const isSensitive    = RESTRICTED.some(r => pathname.startsWith(r.prefix))

  // ── 1. Sem sessão ─────────────────────────────────────────────────────────
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    // Portal sem sessão → login do portal; rotas internas → login do escritório
    url.pathname = isPortalPath ? '/portal/login' : '/login'
    if (pathname !== '/') url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // ── 2. Usuário autenticado no login do escritório ─────────────────────────
  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ── 3. Verificações por papel (uma única query quando necessário) ──────────
  if (user && (isInternalPath || isSensitive || isPortalPath)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, ativo')
      .eq('id', user.id)
      .single()

    const role  = profile?.role as string | undefined
    const ativo = profile?.ativo

    // 3-orphan. Sessão órfã: usuário autenticado sem profile.
    // Fail-secure: nunca concede acesso a rotas protegidas sem profile válido.
    // API routes (/api/*) não passam por aqui — tratam a sessão localmente.
    if (!profile && (isInternalPath || isPortalPath)) {
      const url = request.nextUrl.clone()
      url.pathname = isPortalPath ? '/portal/login' : '/login'
      url.searchParams.set('erro', 'sessao-invalida')
      console.warn(`[proxy] Sessão órfã detectada — user:${user.id} path:${pathname}`)
      return NextResponse.redirect(url)
    }

    // 3a. Role 'cliente' bloqueado de TODAS as rotas internas do escritório
    if (role === 'cliente' && isInternalPath) {
      const url = request.nextUrl.clone()
      url.pathname = '/portal'
      return NextResponse.redirect(url)
    }

    // 3b. Role 'cliente' autenticado tentando acessar login do portal → portal home
    if (role === 'cliente' && isPortalLogin) {
      const url = request.nextUrl.clone()
      url.pathname = '/portal'
      return NextResponse.redirect(url)
    }

    // 3c. Role não-cliente tentando acessar /portal → dashboard do escritório
    if (role && role !== 'cliente' && isPortalPath && !isPortalLogin) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // 3d. Rotas restritas do escritório: verifica papel e conta ativa
    if (isSensitive && role !== 'cliente') {
      if (!role || !ativo || !routeAllowed(role, pathname)) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
