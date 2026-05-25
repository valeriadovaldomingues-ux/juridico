import { createServerClient } from '@supabase/ssr'
import { createClient }       from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { logSecurity } from '@/lib/portal/logger'

// ── Service client para leitura de profiles no middleware ─────────────────────
//
// O createServerClient (anon key) em Edge Runtime não propaga o JWT ao PostgREST
// corretamente, fazendo auth.uid() retornar NULL nas políticas RLS.
// Isso causa a policy "id = auth.uid()" avaliar para FALSE e suprimir o row.
//
// Solução: usar service_role para o check de profile no proxy.
// É seguro porque:
//   1. user.id já foi validado via Auth API (auth.getUser())
//   2. lemos apenas role+ativo do próprio perfil do usuário
//   3. a chave fica apenas server-side (nunca NEXT_PUBLIC_)
//   4. fail-secure mantido: se profile null → redirect (orphan real ou indisponível)
//
// Singleton reutilizado entre requests no mesmo Edge instance.
let _serviceClient: ReturnType<typeof createClient> | null = null

function getServiceClient(): ReturnType<typeof createClient> | null {
  if (_serviceClient) return _serviceClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    // Fallback seguro: sem service key, usa anon key (pode falhar por RLS em Edge)
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[proxy] SUPABASE_SERVICE_ROLE_KEY não configurado — leitura de profiles via anon (pode falhar)')
    }
    return null
  }
  _serviceClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _serviceClient
}

// ── Rotas restritas ───────────────────────────────────────────────────────────
// Deve espelhar RESTRICTED_ROUTES em src/lib/permissions.ts.
// Inlined por compatibilidade com Edge Runtime. Paths mais específicos primeiro.
const RESTRICTED: Array<{ prefix: string; roles: string[] }> = [
  { prefix: '/ia-juridica/aurora',     roles: ['socio'] },
  { prefix: '/financeiro',             roles: ['socio'] },
  { prefix: '/automacoes',             roles: ['gerente', 'socio'] },
  { prefix: '/integracoes/gmail',       roles: ['socio'] },
  { prefix: '/integracoes',            roles: ['gerente', 'socio'] },
  { prefix: '/relatorios',             roles: ['gerente', 'socio'] },
  { prefix: '/comercial',              roles: ['comercial', 'administrativo', 'socio'] },
  { prefix: '/monitoramento',          roles: ['advogado', 'gerente', 'socio'] },
  { prefix: '/importar',               roles: ['administrativo', 'gerente', 'socio'] },
  { prefix: '/ia-juridica',            roles: ['advogado', 'gerente', 'socio'] },
  { prefix: '/configuracoes/usuarios', roles: ['socio'] },
  { prefix: '/configuracoes',          roles: ['socio'] },
]

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

  // Client anon — usado para auth.getUser() (chama Auth REST API diretamente,
  // não depende de RLS/PostgREST).
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

  // Valida sessão via Auth API (não depende de PostgREST nem de RLS)
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // ── Classificação de caminhos ─────────────────────────────────────────────

  const isPortalPath  = pathname.startsWith('/portal')
  const isPortalLogin = pathname === '/portal/login'
  const isAuthPage    = pathname === '/login'
  const isPublicPath  =
    isAuthPage       ||
    isPortalLogin    ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/esqueci-senha') ||
    pathname.startsWith('/redefinir-senha') ||
    pathname.startsWith('/nr1-sem-risco')

  const isInternalPath = INTERNAL_PREFIXES.some(p => pathname.startsWith(p))
  const isSensitive    = RESTRICTED.some(r => pathname.startsWith(r.prefix))

  // ── 1. Sem sessão ─────────────────────────────────────────────────────────
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = isPortalPath ? '/portal/login' : '/login'
    if (pathname !== '/') url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // ── 2. Autenticado tentando acessar /login do escritório ─────────────────
  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ── 3. Verificações por papel ─────────────────────────────────────────────
  if (user && (isInternalPath || isSensitive || isPortalPath)) {

    // Busca profile usando service role (bypassa RLS — necessário em Edge Runtime
    // porque o client anon não propaga o JWT ao PostgREST neste contexto).
    // Fallback para anon se service key não estiver configurada.
    const client = getServiceClient() ?? supabase
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('role, ativo')
      .eq('id', user.id)
      .maybeSingle()

    // Log de erro silencioso da query (apenas em caso de falha real)
    if (profileError) {
      console.error('[proxy] Erro na query de profiles:', {
        userId: user.id,
        code:   profileError.code,
        msg:    profileError.message,
        path:   pathname,
      })
    }

    const role  = profile?.role as string | undefined
    const ativo = profile?.ativo

    // 3-orphan. Sessão órfã: usuário autenticado sem profile válido no banco.
    // Fail-secure: bloqueia acesso sem profile. Exclui /portal/login para
    // evitar redirect loop.
    if (!profile && (isInternalPath || (isPortalPath && !isPortalLogin))) {
      const url = request.nextUrl.clone()
      url.pathname = isPortalPath ? '/portal/login' : '/login'
      url.searchParams.set('erro', 'sessao-invalida')
      logSecurity({
        type:     'orphan_session',
        endpoint: pathname,
        userId:   user.id,
        detail:   profileError ? `query_error:${profileError.code}` : 'no_profile',
      })
      return NextResponse.redirect(url)
    }

    // 3a. Role 'cliente' bloqueado de rotas internas → /portal
    if (role === 'cliente' && isInternalPath) {
      const url = request.nextUrl.clone()
      url.pathname = '/portal'
      return NextResponse.redirect(url)
    }

    // 3b. Role 'cliente' no login do portal → portal home
    if (role === 'cliente' && isPortalLogin) {
      const url = request.nextUrl.clone()
      url.pathname = '/portal'
      return NextResponse.redirect(url)
    }

    // 3c. Staff tentando acessar /portal → dashboard
    if (role && role !== 'cliente' && isPortalPath && !isPortalLogin) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // 3d. Rotas restritas: verifica papel e conta ativa
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
