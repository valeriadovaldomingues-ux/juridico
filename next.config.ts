import type { NextConfig } from 'next'

// ── Content Security Policy ───────────────────────────────────────────────────
//
// Extraído do env para usar o host real do Supabase no connect-src.
// Fallback *.supabase.co cobre todos os projetos Supabase.
//
// Dependências que impedem CSP mais restrita:
//   'unsafe-inline' em script-src:
//     — Next.js injeta <script> inline com __NEXT_DATA__ em cada página
//     — Removível apenas com nonces por request (middleware+CSP dinâmico)
//     — Roadmap: implementar nonce-based CSP quando Next.js estabilizar suporte
//
//   'unsafe-eval' em script-src:
//     — Necessário apenas em desenvolvimento (Turbopack hot-reload / source maps)
//     — Em produção: Next.js não usa eval() no bundle gerado
//     — Solução: condicional por NODE_ENV abaixo
//
// CSP Report-Only:
//   Definir CSP_REPORT_URI no .env.local para ativar modo report-only em paralelo.
//   Permite testar uma CSP mais restrita sem quebrar o app em produção.
//   Serviços sugeridos: sentry.io, report-uri.com, ou endpoint próprio.

const isDev = process.env.NODE_ENV === 'development'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseHost = supabaseUrl
  ? (() => { try { return new URL(supabaseUrl).host } catch { return '*.supabase.co' } })()
  : '*.supabase.co'

const cspDirectives = [
  "default-src 'self'",

  // unsafe-eval removido em produção — Next.js 16+ não usa eval no bundle produção.
  // Mantido em dev para Turbopack hot-reload e source maps.
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",

  // unsafe-inline necessário para estilos Tailwind injetados pelo Next.js.
  "style-src 'self' 'unsafe-inline'",

  // Supabase Storage (avatares, docs via redirect), data URIs para favicon.
  `img-src 'self' data: blob: https://${supabaseHost}`,

  "font-src 'self'",

  // API calls para Supabase (auth REST, Realtime WebSocket, Storage).
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,

  // Bloqueia iframes externos (reforço ao X-Frame-Options).
  "frame-ancestors 'none'",

  // Bloqueia plugins NPAPI/ActiveX (Flash, Java, etc.).
  "object-src 'none'",

  // Previne base tag hijacking (redirecionar recursos relativos).
  "base-uri 'self'",

  // Restringe destinos de submit de formulários.
  "form-action 'self'",

  // Força upgrade de recursos HTTP → HTTPS (apenas em produção).
  ...(!isDev ? ["upgrade-insecure-requests"] : []),
]

const csp           = cspDirectives.join('; ')
const cspReportUri  = process.env.CSP_REPORT_URI
const cspReportOnly = cspReportUri
  ? cspDirectives.join('; ') + `; report-uri ${cspReportUri}`
  : null

// ── Headers de segurança ──────────────────────────────────────────────────────

const coreHeaders = [
  // Força HTTPS por 2 anos, incluindo subdomínios.
  {
    key:   'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },

  // Bloqueia embedding em iframes externos (clickjacking).
  {
    key:   'X-Frame-Options',
    value: 'SAMEORIGIN',
  },

  // Bloqueia MIME sniffing — browser respeita o Content-Type declarado.
  {
    key:   'X-Content-Type-Options',
    value: 'nosniff',
  },

  // Controla informação exposta no Referer header em requests cross-origin.
  {
    key:   'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },

  // Prefetch de DNS — melhora performance de primeira conexão.
  {
    key:   'X-DNS-Prefetch-Control',
    value: 'on',
  },

  // CSP principal.
  {
    key:   'Content-Security-Policy',
    value: csp,
  },
]

// ── Headers de isolamento cross-origin ────────────────────────────────────────
//
// Rollback: basta comentar crossOriginHeaders e remover do array headers() abaixo.

const crossOriginHeaders = [
  // Isola o browsing context de documentos cross-origin.
  // Previne ataques via window.opener e cross-origin frame manipulation.
  // 'same-origin-allow-popups': permite popups de mesmo origem (compatibilidade OAuth).
  // Incompatibilidade conhecida: nenhuma — app usa magic link (redirect, não popup).
  {
    key:   'Cross-Origin-Opener-Policy',
    value: 'same-origin-allow-popups',
  },

  // Diz ao browser: "este recurso só pode ser incluído por páginas do mesmo site."
  // Protege contra ataques Spectre sidechannel cross-origin.
  // Incompatibilidade conhecida: nenhuma — app não serve recursos para terceiros.
  {
    key:   'Cross-Origin-Resource-Policy',
    value: 'same-site',
  },
]

// ── Permissions-Policy ────────────────────────────────────────────────────────
//
// Desativa APIs de browser não usadas pelo sistema.
// Cada API desativada reduz a superficie de ataque e impede rastreamento.

const permissionsPolicy = [
  'camera=()',                      // câmera — não usada
  'microphone=()',                  // microfone — não usado
  'geolocation=()',                 // localização — não usada
  'payment=()',                     // API de pagamento — não usada
  'display-capture=()',             // screen capture — não usado
  'interest-cohort=()',             // FLoC — desabilitado (privacidade)
  'browsing-topics=()',             // Topics API — desabilitado (privacidade)
  'private-state-token-issuance=()',// Trust Tokens — não usado
].join(', ')

const permissionsHeader = {
  key:   'Permissions-Policy',
  value: permissionsPolicy,
}

// ── CSP Report-Only (opcional) ────────────────────────────────────────────────

const reportOnlyHeaders = cspReportOnly
  ? [{
      key:   'Content-Security-Policy-Report-Only',
      value: cspReportOnly,
    }]
  : []

// ── Configuração do Next.js ───────────────────────────────────────────────────

const nextConfig: NextConfig = {
  async headers() {
    const allHeaders = [
      ...coreHeaders,
      ...crossOriginHeaders,
      permissionsHeader,
      ...reportOnlyHeaders,
    ]

    return [
      {
        source:  '/:path*',
        headers: allHeaders,
      },
    ]
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/**',
      },
    ],
  },

  logging: {
    fetches: {
      fullUrl: isDev,
    },
  },

  compress:        true,
  poweredByHeader: false,

  async redirects() {
    return [
      {
        source:      '/',
        destination: '/dashboard',
        permanent:   false,
      },
    ]
  },
}

export default nextConfig
