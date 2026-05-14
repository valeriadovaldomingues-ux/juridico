import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Logo from '@/components/ui/Logo'
import LogoutButton from './LogoutButton'

export const metadata = { title: 'Portal do Cliente — PEDV' }

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Sem sessão → login do portal
  if (!user) redirect('/portal/login')

  // Verifica se é realmente um cliente — segurança adicional ao proxy
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, ativo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.ativo || profile.role !== 'cliente') {
    // Funcionário do escritório que chegou aqui → manda para dashboard
    if (profile?.role && profile.role !== 'cliente') redirect('/dashboard')
    redirect('/portal/login')
  }

  return (
    <div className="min-h-screen bg-[#F7F9F9]">

      {/* Header mínimo do portal */}
      <header className="bg-white border-b border-[#D0DCDC] px-6 py-3 flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <Logo variant="sidebar" />
          <span className="text-[12px] text-[#9ca3af] border-l border-[#e5e7eb] pl-3">
            Portal do Cliente
          </span>
        </div>
        <LogoutButton />
      </header>

      {/* Conteúdo da página */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </main>

    </div>
  )
}
