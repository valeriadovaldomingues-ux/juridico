import type { NextConfig } from 'next'

// ── Content Security Policy ───────────────────────────────────────────────────
// Extraído do env para poder usar o host real do Supabase no connect-src.
// Fallback para *.supabase.co cobre todos os projetos Supabase.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseHost = supabaseUrl
  ? (() => { try { return new URL(supabaseUrl).host } catch { return '*.supabase.co' } })()
  : '*.supabase.co'

const csp = [
  "default-src 'self'",
  // Next.js injeta scripts inline para hidratação — unsafe-inline necessário
  // até suporte nativo a nonces no App Router ser estável.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  // Supabase Storage + data URIs para favicon/logo
  `img-src 'self' data: blob: https://${supabaseHost}`,
  "font-src 'self'",
  // API calls para Supabase (auth, realtime, storage, REST)
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
  // Bloqueia iframes externos (reforça X-Frame-Options)
  "frame-ancestors 'none'",
  // Bloqueia plugins (Flash, Java, etc.)
  "object-src 'none'",
  // Previne base tag hijacking
  "base-uri 'self'",
  // Restringe onde forms podem enviar dados
  "form-action 'self'",
].join('; ')

// ── Headers de segurança HTTP ────────────────────────────────────────────────
// Aplicados a todas as respostas. Protegem contra ataques comuns.
const securityHeaders = [
  // Força HTTPS por 2 anos, incluindo subdomínios
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Impede que a página seja embutida em iframe (clickjacking)
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  // Impede que o browser "adivinhe" o tipo de conteúdo (MIME sniffing)
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Controla quanto de informação o Referer header expõe
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Restringe acesso a funcionalidades do browser não usadas pelo sistema
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  // Prefetch de DNS habilitado para melhor performance
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  // Content Security Policy — veja definição acima
  {
    key:   'Content-Security-Policy',
    value: csp,
  },
]

const nextConfig: NextConfig = {
  // ── Headers de segurança ───────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },

  // ── Imagens ────────────────────────────────────────────────────────────────
  // Adicione aqui domínios externos de onde o sistema carrega imagens
  images: {
    remotePatterns: [
      // Supabase Storage (avatares, documentos, etc.)
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/**',
      },
    ],
  },

  // ── Logs de build ─────────────────────────────────────────────────────────
  // Silencia logs de performance do compilador em produção
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },

  // ── Compressão ─────────────────────────────────────────────────────────────
  compress: true,

  // ── Powered-by header ──────────────────────────────────────────────────────
  // Remove o header X-Powered-By: Next.js por segurança (não revelar stack)
  poweredByHeader: false,

  // ── Redirects ─────────────────────────────────────────────────────────────
  async redirects() {
    return [
      // Redireciona a raiz para o dashboard (protegido pelo middleware)
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
      },
    ]
  },
}

export default nextConfig
