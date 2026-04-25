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

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

interface NavGroup {
  label: string
  items: NavItem[]
}

// Todos os itens disponíveis — filtrados por role ao renderizar
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
    if (href === '/dashboard') return pathname === '/dashboard'
    // Evita que /configuracoes fique ativo quando a rota ativa é /configuracoes/usuarios
    if (href === '/configuracoes') return pathname === '/configuracoes'
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-[220px] flex-shrink-0 flex flex-col bg-[#0F3D3E]">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <Logo variant="sidebar" />
      </div>

      <div className="mx-5 border-t border-[#b8903a]/20" />

      {/* Navegação */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
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
                      'group relative flex items-center gap-3 px-3 py-[9px] rounded-xl text-[13px] font-medium transition-all duration-150',
                      active
                        ? 'bg-white/[0.12] text-white'
                        : 'text-white/45 hover:text-white/85 hover:bg-white/[0.07]'
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 inset-y-[5px] w-[3px] rounded-r-full bg-[#d4a94e]" />
                    )}
                    <Icon
                      size={15}
                      className={cn(
                        'flex-shrink-0 transition-colors',
                        active ? 'text-[#d4a94e]' : 'text-white/35 group-hover:text-white/65'
                      )}
                    />
                    {item.label}
                    {active && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#d4a94e]/70" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mx-5 border-t border-[#b8903a]/20" />
      <div className="px-5 py-4">
        <p className="text-[10px] text-[#b8903a]/40 tracking-wide">v1.0 &mdash; MVP</p>
      </div>
    </aside>
  )
}
