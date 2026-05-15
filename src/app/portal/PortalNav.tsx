'use client'

import Link        from 'next/link'
import { usePathname } from 'next/navigation'
import { Scale, CalendarDays, FileText, MessageSquare, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/portal',            label: 'Início',      icon: Home          },
  { href: '/portal/processos',  label: 'Processos',   icon: Scale         },
  { href: '/portal/agenda',     label: 'Agenda',      icon: CalendarDays  },
  { href: '/portal/documentos', label: 'Documentos',  icon: FileText      },
  { href: '/portal/mensagens',  label: 'Mensagens',   icon: MessageSquare },
]

export default function PortalNav() {
  const pathname = usePathname()

  return (
    <nav className="bg-[#0C1B2A]/95 border-b border-[#C49557]/15">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-0 overflow-x-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === '/portal'
            ? pathname === '/portal'
            : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 px-4 py-3.5 text-[11px] tracking-[0.08em] uppercase font-medium whitespace-nowrap border-b-2 -mb-px transition-all',
                active
                  ? 'border-[#C49557] text-[#C49557]'
                  : 'border-transparent text-white/40 hover:text-white/75 hover:border-white/20',
              )}
            >
              <Icon size={12} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
