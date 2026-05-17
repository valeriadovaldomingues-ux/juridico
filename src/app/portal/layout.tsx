import { createClient } from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import Link              from 'next/link'
import { Cormorant_Garamond } from 'next/font/google'
import LogoutButton from './LogoutButton'
import PortalNav    from './PortalNav'

export const metadata = { title: 'Portal do Cliente — Pessoa e do Val Advocacia' }

// Fonte serif da identidade Pessoa e do Val
const cormorant = Cormorant_Garamond({
  subsets:  ['latin'],
  weight:   ['300', '400', '600', '700'],
  style:    ['normal', 'italic'],
  display:  'swap',
  variable: '--font-serif',
})

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Sem sessão: o proxy já redireciona qualquer rota não-pública para /portal/login.
  // A única rota sem sessão que chega aqui é o próprio /portal/login (isPublicPath=true).
  // Redirecionar para /portal/login aqui causaria loop infinito — renderizar children diretamente.
  if (!user) return <>{children}</>

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, ativo')
    .eq('id', user.id)
    .single()

  // Staff autenticado (qualquer role que não seja 'cliente'): redireciona para painel interno.
  // Segregação preservada: staff nunca acessa dados do cliente via portal.
  if (!profile || !profile.ativo || profile.role !== 'cliente') {
    if (profile?.role && profile.role !== 'cliente') redirect('/dashboard')
    // Sem profile ou inativo: fail-secure → login (portalGuard() bloqueia as APIs também)
    redirect('/portal/login')
  }

  return (
    <div className={`${cormorant.variable} min-h-screen bg-[#F5F0E8]`}>

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
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 portal-page">
        {children}
      </main>

      {/* ── Rodapé ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#EDE8DF] mt-12 py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between">
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
