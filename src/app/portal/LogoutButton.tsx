'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    // scope: 'global' invalida todos os tokens de refresh do usuário em todos
    // os dispositivos, não apenas a sessão atual.
    await supabase.auth.signOut({ scope: 'global' })
    router.push('/portal/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-1.5 text-[12px] text-[#7a8899] hover:text-[#0f1923] transition-colors"
    >
      <LogOut size={13} />
      Sair
    </button>
  )
}
