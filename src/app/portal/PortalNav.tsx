'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Scale, CalendarDays, FileText, MessageSquare, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/portal',           label: 'Início',     icon: Home          },
  { href: '/portal/processos', label: 'Processos',  icon: Scale         },
  { href: '/portal/agenda',    label: 'Agenda',     icon: CalendarDays  },
  { href: '/portal/documentos',label: 'Documentos', icon: FileText      },
  { href: '/portal/mensagens', label: 'Mensagens',  icon: MessageSquare },
]

export default function PortalNav() {
  const pathname = usePathname()

  return (
    <nav className="bg-white border-b border-[#f3f4f6] px-4 sm:px-6">
      <div className="max-w-5xl mx-auto flex gap-1 overflow-x-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === '/portal'
            ? pathname === '/portal'
            : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-3 text-[13px] font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
                active
                  ? 'border-[#145A5B] text-[#145A5B]'
                  : 'border-transparent text-[#7a8899] hover:text-[#374151] hover:bg-[#f9fafb]',
              )}
            >
              <Icon size={14} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
