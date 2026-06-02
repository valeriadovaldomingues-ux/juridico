import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Painel Diário — Pessoa e do Val Advocacia',
}

/**
 * Layout isolado para o Painel TV Diário.
 * Sem Sidebar nem Header do dashboard — tela limpa para exibição em TV.
 * Acesso para usuários internos autenticados, exceto cliente.
 */
export default async function PainelDiarioLayout({
  children,
}: {
  children: React.ReactNode
}) {
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

  if (profile.role === 'cliente') {
    redirect('/portal')
  }

  return (
    <div
      className="w-screen h-screen overflow-hidden text-white select-none"
      style={{ background: '#030C17' }}
    >
      {children}
    </div>
  )
}
