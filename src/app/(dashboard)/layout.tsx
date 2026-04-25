import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import type { Profile, UserRole } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('id, nome, email, role, ativo, created_at')
    .eq('id', user.id)
    .single()

  const profile = profileData as Profile | null

  // Conta desativada: encerrar sessão e redirecionar
  if (profile && !profile.ativo) {
    await supabase.auth.signOut()
    redirect('/login?erro=conta-desativada')
  }

  // Role padrão mais restritivo caso o profile ainda não exista
  const role = (profile?.role ?? 'estagiario') as UserRole

  const isDev = process.env.NODE_ENV === 'development'

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F9F9]">
      <Sidebar role={role} devMode={isDev} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header profile={profile} />
        <main className="flex-1 overflow-y-auto p-7">
          {children}
        </main>
      </div>
    </div>
  )
}
