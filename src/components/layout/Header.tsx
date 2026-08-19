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
  '/comercial':              'Comercial',
  '/ferramentas-pdf':        'Ferramentas PDF',
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
  return nome.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('')
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
    <header className="h-[52px] bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center justify-between px-5 flex-shrink-0 shadow-[0_1px_0_rgba(20,32,51,0.02)]">

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={12} className="text-[var(--color-border-mid)]" />}
            <span className={
              i === crumbs.length - 1
                ? 'font-brand text-[18px] font-semibold text-[var(--color-ink)] leading-none'
                : 'text-[13px] text-[var(--color-ink-3)]'
            }>
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* Perfil e ações */}
      <div className="flex items-center gap-2.5">

        {profile && (
          <div className="flex items-center gap-2.5">
            {roleLabel && roleColor && (
              <span className={`hidden sm:inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide ${roleColor}`}>
                {roleLabel}
              </span>
            )}
            <div className="flex items-center gap-2">
              {/* Avatar */}
              <div className="w-6 h-6 rounded-full bg-[var(--color-sidebar)] ring-1 ring-[var(--color-copper)]/25 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-white leading-none select-none">
                  {getInitials(profile.nome)}
                </span>
              </div>
              <span className="hidden md:block text-[12px] font-medium text-[var(--color-ink-2)] max-w-[140px] truncate">
                {profile.nome}
              </span>
            </div>
          </div>
        )}

        <div className="w-px h-4 bg-[var(--color-border)]" />

        <NotificationBell />

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] text-[var(--color-ink-3)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-warm)] transition-all"
          title="Sair"
        >
          <LogOut size={13} />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  )
}
