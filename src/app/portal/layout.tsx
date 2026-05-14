import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/ui/Logo'
import LogoutButton from './LogoutButton'
import PortalNav from './PortalNav'

export const metadata = { title: 'Portal do Cliente — PEDV' }

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/portal/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, ativo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.ativo || profile.role !== 'cliente') {
    if (profile?.role && profile.role !== 'cliente') redirect('/dashboard')
    redirect('/portal/login')
  }

  return (
    <div className="min-h-screen bg-[#F7F9F9]">

      {/* Header */}
      <header className="bg-white border-b border-[#D0DCDC] px-6 py-3 flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <Link href="/portal">
            <Logo variant="sidebar" />
          </Link>
          <span className="text-[12px] text-[#9ca3af] border-l border-[#e5e7eb] pl-3 hidden sm:block">
            Portal do Cliente
          </span>
        </div>
        <LogoutButton />
      </header>

      {/* Navegação */}
      <PortalNav />

      {/* Conteúdo */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>

    </div>
  )
}
