'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import Header from './Header'
import type { Profile, UserRole } from '@/types'

/** Casca do painel interno — organiza menu lateral, cabeçalho e conteúdo,
 *  e controla o estado de "menu aberto/fechado" no celular (a Sidebar em si
 *  fica sempre montada; no desktop `md:` ela ignora esse estado). */
export default function DashboardShell({
  role, devMode, profile, children,
}: {
  role: UserRole
  devMode: boolean
  profile: Profile | null
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  // Fecha o menu automaticamente ao navegar — sem isso, no celular o menu
  // ficaria aberto por cima da página nova depois de tocar num link.
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-[#F3F1EE]">
      <Sidebar
        role={role}
        userId={profile?.id}
        devMode={devMode}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Fundo escurecido atrás do menu, só no celular — tocar fecha o menu */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header profile={profile} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 internal-page">
          {children}
        </main>
      </div>
    </div>
  )
}
