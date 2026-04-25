'use client'

import { usePathname, useRouter } from 'next/navigation'
import { LogOut, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/permissions'
import type { Profile } from '@/types'
import NotificationBell from './NotificationBell'

const routeLabels: Record<string, string> = {
  '/dashboard':              'Dashboard',
  '/clientes':               'Clientes',
  '/processos':              'Processos',
  '/agenda':                 'Agenda',
  '/financeiro':             'Financeiro',
  '/documentos':             'Documentos',
  '/ia-juridica':            'IA Jurídica',
  '/relatorios':             'Relatórios',
  '/importar':               'Importar',
  '/configuracoes/usuarios': 'Usuários',
  '/configuracoes':          'Configurações',
  '/kanban':                 'Kanban',
  '/publicacoes':            'Publicações',
  '/automacoes':             'Automações',
  '/monitoramento':          'Monitoramento',
}

function getLabel(pathname: string): string {
  for (const key of Object.keys(routeLabels).sort((a, b) => b.length - a.length)) {
    if (pathname.startsWith(key)) return routeLabels[key]
  }
  return 'PEDV'
}

function getBreadcrumb(pathname: string): string[] {
  const label    = getLabel(pathname)
  const isNovo   = pathname.endsWith('/novo')
  const isDetail = pathname.split('/').length > 2 && !isNovo
  if (isNovo)   return [label, 'Novo']
  if (isDetail) return [label, 'Detalhes']
  return [label]
}

function getInitials(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('')
}

export default function Header({ profile }: { profile: Profile | null }) {
  const router   = useRouter()
  const pathname = usePathname()
  const crumbs   = getBreadcrumb(pathname)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const roleLabel = profile?.role ? ROLE_LABELS[profile.role] : null
  const roleColor = profile?.role ? ROLE_COLORS[profile.role] : null

  return (
    <header className="h-[52px] bg-white border-b border-[#D0DCDC] flex items-center justify-between px-6 flex-shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={13} className="text-[#c5cdd8]" />}
            <span className={
              i === crumbs.length - 1
                ? 'text-[13px] font-semibold text-[#0f1923]'
                : 'text-[13px] text-[#7a8899]'
            }>
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* Perfil e ações */}
      <div className="flex items-center gap-3">

        {/* Info do usuário logado */}
        {profile && (
          <div className="flex items-center gap-2.5">
            {/* Badge de papel */}
            {roleLabel && roleColor && (
              <span className={`hidden sm:inline-flex text-[11px] font-medium px-2.5 py-0.5 rounded-full ${roleColor}`}>
                {roleLabel}
              </span>
            )}
            {/* Avatar + nome */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#0F3D3E] flex items-center justify-center flex-shrink-0">
                <span className="text-[11px] font-bold text-white leading-none select-none">
                  {getInitials(profile.nome)}
                </span>
              </div>
              <span className="hidden md:block text-[13px] font-medium text-[#374151] max-w-[140px] truncate">
                {profile.nome}
              </span>
            </div>
          </div>
        )}

        <div className="w-px h-5 bg-[#D0DCDC]" />

        <NotificationBell />

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] text-[#7a8899] hover:text-[#0f1923] hover:bg-[#F7F9F9] transition-all"
          title="Sair"
        >
          <LogOut size={14} />
          <span>Sair</span>
        </button>
      </div>
    </header>
  )
}
