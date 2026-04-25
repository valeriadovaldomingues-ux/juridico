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

  // Rotas públicas que não exigem autenticação
  const isAuthPage   = pathname === '/login'
  const isPublicPath =
    isAuthPage ||
    pathname.startsWith('/auth') ||           // callbacks OAuth do Supabase
    pathname.startsWith('/reset-password')    // fluxo de reset de senha via e-mail

  // Usuário não autenticado → redirecionar para login
  // (preserva a URL original como ?next= para redirecionar após login)
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    if (pathname !== '/') url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Usuário autenticado tentando acessar login → redirecionar para dashboard
  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Verificação de papel para rotas restritas
  if (user) {
    const isSensitive = RESTRICTED.some(r => pathname.startsWith(r.prefix))
    if (isSensitive) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, ativo')
        .eq('id', user.id)
        .single()

      const role  = profile?.role as string | undefined
      const ativo = profile?.ativo

      // Conta desativada ou papel insuficiente → redirecionar para dashboard
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
