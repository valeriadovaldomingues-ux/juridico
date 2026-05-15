/**
 * Verificação de Origin/Referer para proteção CSRF em rotas POST do portal.
 *
 * Bloqueia requisições de origins externas garantindo que apenas o próprio
 * frontend PEDV possa chamar as API routes do portal.
 *
 * Compatível com ambientes dev (localhost) e produção (domínio configurado).
 */

/**
 * Retorna true se o request vem de uma origin permitida.
 *
 * Origens permitidas:
 *   1. process.env.NEXT_PUBLIC_APP_URL (produção/staging)
 *   2. http(s)://localhost:* (desenvolvimento local)
 *   3. Ausência total de Origin header (server-to-server, Postman em dev)
 *
 * Em produção, requests sem Origin de um browser real são raros —
 * se desejado, pode-se adicionar `allowMissingOrigin: false` para bloquear.
 */
export function isAllowedOrigin(
  request: Request,
  options: { allowMissingOrigin?: boolean } = { allowMissingOrigin: true },
): boolean {
  const origin = request.headers.get('origin')

  // Sem origin header (server-to-server, curl, Postman)
  if (!origin) return options.allowMissingOrigin ?? true

  // localhost em qualquer porta (dev)
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true

  // 127.0.0.1 em qualquer porta (dev)
  if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true

  // Domínio configurado da aplicação
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl && origin === appUrl.replace(/\/$/, '')) return true

  // Vercel preview deployments (*.vercel.app)
  if (process.env.VERCEL_URL && origin.endsWith('.vercel.app')) return true

  return false
}

/**
 * Verifica o Origin e retorna uma Response de erro 403 se bloqueado,
 * ou null se permitido.
 *
 * Uso em API Routes:
 *   const blocked = checkOrigin(request)
 *   if (blocked) return blocked
 */
export function checkOrigin(
  request: Request,
  endpoint = request.url,
): Response | null {
  if (!isAllowedOrigin(request)) {
    // Import dinâmico evita circular dependency (logger não depende de origin)
    import('@/lib/portal/logger').then(({ logSecurity }) => {
      logSecurity({
        type:     'csrf_block',
        endpoint,
        detail:   request.headers.get('origin') ?? 'no-origin',
      })
    }).catch(() => {/* silencioso */})

    return new Response(
      JSON.stringify({ error: 'Origin não autorizado' }),
      {
        status:  403,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
  return null
}
