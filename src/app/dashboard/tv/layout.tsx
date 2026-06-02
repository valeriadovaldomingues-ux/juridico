import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * TV layout — completamente isolado do grupo (dashboard).
 *
 * Por que a estrutura de pastas importa no App Router:
 *   src/app/(dashboard)/tv/page.tsx  =>  URL: /tv      (grupo não entra na URL)
 *   src/app/dashboard/tv/page.tsx    =>  URL: /dashboard/tv
 *
 * Por estar fora do grupo (dashboard), este layout NAO herda
 * o DashboardLayout com Sidebar + Header. Resultado: tela 100% limpa.
 */
export default async function TVLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, ativo')
    .eq('id', user.id)
    .single()

  if (!profile?.ativo) {
    await supabase.auth.signOut()
    redirect('/login?erro=conta-desativada')
  }

  // Painel TV restrito a sócio (dados sensiveis do escritorio)
  if (profile.role !== 'socio') {
    redirect('/dashboard')
  }

  return (
    // Ocupa 100% da viewport — sem sidebar, sem cabecalho, sem scroll
    <div className="w-screen h-screen bg-[#07101f] overflow-hidden text-white">
      {children}
    </div>
  )
}
