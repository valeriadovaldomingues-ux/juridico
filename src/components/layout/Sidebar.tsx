'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Scale, CalendarDays,
  DollarSign, FileText, Bot, Settings, BarChart2,
  Upload, Columns, Newspaper, Radar, UserCog, Handshake, ArrowLeftRight, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Logo from '@/components/ui/Logo'
import { ALLOWED_ROUTES } from '@/lib/permissions'
import type { UserRole } from '@/types'

interface NavItem  { href: string; label: string; icon: React.ElementType }
interface NavGroup { label: string; items: NavItem[] }

const ALL_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Principal',
    items: [
      { href: '/dashboard',  label: 'Dashboard', icon: LayoutDashboard },
      { href: '/clientes',   label: 'Clientes',  icon: Users },
      { href: '/processos',  label: 'Processos', icon: Scale },
      { href: '/agenda',     label: 'Agenda',    icon: CalendarDays },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { href: '/kanban',      label: 'Kanban',      icon: Columns    },
      { href: '/publicacoes', label: 'Publicações', icon: Newspaper  },
      { href: '/comercial',   label: 'Comercial',   icon: Handshake  },
      { href: '/financeiro',  label: 'Financeiro',  icon: DollarSign },
      { href: '/documentos',  label: 'Documentos',  icon: FileText   },
      { href: '/relatorios',  label: 'Relatórios',  icon: BarChart2  },
      { href: '/importar',    label: 'Importar',    icon: Upload     },
    ],
  },
  {
    label: 'Automação',
    items: [
      { href: '/automacoes',    label: 'Automações',    icon: Zap   },
      { href: '/monitoramento', label: 'Monitoramento', icon: Radar },
    ],
  },
  {
    label: 'Inteligência',
    items: [
      { href: '/ia-juridica', label: 'IA Jurídica', icon: Bot },
    ],
  },
  {
    label: 'Integrações',
    items: [
      { href: '/integracoes/trello', label: 'Trello', icon: ArrowLeftRight },
    ],
  },
  {
    label: 'Administração',
    items: [
      { href: '/configuracoes/usuarios', label: 'Usuários',      icon: UserCog },
      { href: '/configuracoes',          label: 'Configurações', icon: Settings },
    ],
  },
]

export default function Sidebar({ role, devMode = false }: { role: UserRole; devMode?: boolean }) {
  const pathname = usePathname()
  const allowed  = ALLOWED_ROUTES[role]

  const visibleGroups = ALL_NAV_GROUPS
    .map(group => ({
      ...group,
      items: devMode
        ? group.items
        : group.items.filter(item => allowed.includes(item.href)),
    }))
    .filter(group => group.items.length > 0)

  function isActive(href: string): boolean {
    if (href === '/dashboard')     return pathname === '/dashboard'
    if (href === '/configuracoes') return pathname === '/configuracoes'
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-[216px] flex-shrink-0 flex flex-col bg-[#162030] select-none">

      {/* Logo */}
      <div className="px-4 pt-5 pb-4">
        <Logo variant="sidebar" />
      </div>

      {/* Divider dourado sutil */}
      <div className="mx-4 h-px bg-gradient-to-r from-[#C49557]/25 via-[#C49557]/8 to-transparent" />

      {/* Navegação */}
      <nav className="flex-1 px-2.5 py-4 overflow-y-auto space-y-5">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/20">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon   = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150',
                      active
                        ? 'bg-white/[0.09] text-white'
                        : 'text-white/40 hover:text-white/80 hover:bg-white/[0.05]'
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 inset-y-[6px] w-[2.5px] rounded-r-full bg-[#C49557]" />
                    )}
                    <Icon
                      size={14}
                      strokeWidth={active ? 1.75 : 1.5}
                      className={cn(
                        'flex-shrink-0 transition-colors duration-150',
                        active ? 'text-[#C49557]' : 'text-white/30 group-hover:text-white/60'
                      )}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {active && (
                      <span className="w-1 h-1 rounded-full bg-[#C49557]/60 flex-shrink-0" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Rodapé */}
      <div className="mx-4 h-px bg-white/[0.06]" />
      <div className="px-5 py-3.5">
        <p className="text-[9px] text-white/15 tracking-[0.08em] uppercase">
          P&V · Sistema Jurídico
        </p>
      </div>
    </aside>
  )
}
