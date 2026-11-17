import Link from 'next/link'
import { getPortalSession } from '@/lib/auth/portal-guard'
import LogoutButton from './LogoutButton'
import FaixaPrevia from './FaixaPrevia'
import PortalNav    from './PortalNav'

export const metadata = { title: 'Portal do Cliente — Pessoa e do Val Advocacia' }

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Sessão PRÓPRIA do portal (cookie opaco validado no banco), sem Supabase Auth.
  // Sem sessão renderiza só o conteúdo: é o caso de /portal/login. As demais páginas
  // redirecionam para o login por conta própria (exigirSessaoPortal), o que evita loop aqui.
  const session = await getPortalSession()
  if (!session) return <>{children}</>

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {session.previa && <FaixaPrevia clienteNome={session.clienteNome} clienteId={session.clienteId} />}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-[#0C1B2A] border-b border-[#C49557]/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">

          {/* Marca */}
          <Link href="/portal" className="flex flex-col leading-none group">
            <span
              className="text-white text-[20px] tracking-tight group-hover:text-[#D4A86A] transition-colors"
              style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}
            >
              Pessoa e do Val
            </span>
            <span className="text-[#C49557] text-[9px] tracking-[0.2em] uppercase mt-0.5">
              Advocacia
            </span>
          </Link>

          {/* Ações */}
          <div className="flex items-center gap-4">
            <span className="text-white/25 text-[11px] tracking-wider uppercase hidden sm:block">
              Portal do Cliente
            </span>
            <div className="w-px h-4 bg-white/10 hidden sm:block" />
            <LogoutButton />
          </div>
        </div>

        {/* Linha dourada sutil — assinatura visual da marca */}
        <div className="h-px bg-gradient-to-r from-transparent via-[#C49557]/40 to-transparent" />
      </header>

      {/* ── Navegação ───────────────────────────────────────────────────────── */}
      <PortalNav />

      {/* ── Conteúdo ────────────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 portal-page">
        {children}
      </main>

      {/* ── Rodapé ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#EDE8DF] mt-12 py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row gap-1 sm:items-center sm:justify-between">
          <span className="text-[11px] text-[#9CA3AF] tracking-wide">
            Pessoa e do Val Advocacia · Belo Horizonte, MG
          </span>
          <span className="text-[11px] text-[#C49557]/60 tracking-wider uppercase">
            P&amp;V · Desde 2002
          </span>
        </div>
      </footer>

    </div>
  )
}
