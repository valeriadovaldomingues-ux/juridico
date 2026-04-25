import type { NextConfig } from 'next'

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
