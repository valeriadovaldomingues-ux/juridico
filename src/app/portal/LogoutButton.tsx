'use client'

import { useRouter } from 'next/navigation'
import { LogOut }    from 'lucide-react'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    try {
      await fetch('/api/portal/auth/sair', { method: 'POST' })
    } finally {
      router.push('/portal/login')
      router.refresh()
    }
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-1.5 text-[11px] tracking-[0.08em] uppercase text-white/40 hover:text-white/80 transition-colors"
    >
      <LogOut size={12} />
      Sair
    </button>
  )
}
