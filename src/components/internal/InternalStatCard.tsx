import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Props {
  icon:      LucideIcon
  label:     string
  value:     number | string
  href?:     string
  trend?:    'up' | 'down' | 'neutral'
  trendText?: string
  variant?:  'default' | 'teal' | 'gold' | 'alert'
}

const VARIANTS = {
  default: {
    icon:  'text-[#9CA3AF] bg-[#F3F1EE] border-[#E2DDD8]',
    value: 'text-[#111827]',
  },
  teal: {
    icon:  'text-[#1D5F60] bg-[#E8F2F2] border-[#BCE4E4]',
    value: 'text-[#1D5F60]',
  },
  gold: {
    icon:  'text-[#C49557] bg-[#FBF5EC] border-[#EDD9B8]',
    value: 'text-[#C49557]',
  },
  alert: {
    icon:  'text-rose-600 bg-rose-50 border-rose-100',
    value: 'text-rose-700',
  },
}

/**
 * Card de estatística/métrica do sistema interno.
 * Denso, funcional — sem excesso visual.
 */
export default function InternalStatCard({
  icon: Icon, label, value, href, trend, trendText, variant = 'default',
}: Props) {
  const v = VARIANTS[variant]

  const content = (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-[#9CA3AF] uppercase tracking-[0.06em] font-medium mb-1">
          {label}
        </p>
        <p className={cn('text-[22px] font-semibold leading-none tabular-nums', v.value)}>
          {value}
        </p>
        {trendText && (
          <p className={cn(
            'text-[11px] mt-1.5',
            trend === 'up'   ? 'text-emerald-600' :
            trend === 'down' ? 'text-rose-600'    :
            'text-[#9CA3AF]'
          )}>
            {trendText}
          </p>
        )}
      </div>
      <div className={cn('w-9 h-9 rounded-lg border flex items-center justify-center shrink-0', v.icon)}>
        <Icon size={15} strokeWidth={1.5} />
      </div>
    </div>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="block bg-white border border-[#E2DDD8] rounded-lg p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-[#1D5F60]/30 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-150"
      >
        {content}
      </Link>
    )
  }

  return (
    <div className="bg-white border border-[#E2DDD8] rounded-lg p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {content}
    </div>
  )
}
