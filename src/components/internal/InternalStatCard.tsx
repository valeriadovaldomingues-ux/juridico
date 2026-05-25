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
    icon:  'text-[var(--color-ink-3)] bg-[var(--color-surface-warm)] border-[var(--color-border)]',
    value: 'text-[var(--color-ink)]',
  },
  teal: {
    icon:  'text-[var(--color-petrol)] bg-[var(--color-petrol-light)] border-[#CBD9DF]',
    value: 'text-[var(--color-petrol)]',
  },
  gold: {
    icon:  'text-[var(--color-copper)] bg-[var(--color-gold-light)] border-[#E7CBA8]',
    value: 'text-[var(--color-copper)]',
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
        <p className="text-[11px] text-[var(--color-ink-3)] uppercase tracking-[0.08em] font-medium mb-1">
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
            'text-[var(--color-ink-3)]'
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
        className="block bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 shadow-[0_8px_24px_rgba(20,32,51,0.045)] hover:border-[var(--color-copper)]/35 hover:shadow-[0_12px_30px_rgba(20,32,51,0.07)] transition-all duration-150"
      >
        {content}
      </Link>
    )
  }

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 shadow-[0_8px_24px_rgba(20,32,51,0.045)]">
      {content}
    </div>
  )
}
