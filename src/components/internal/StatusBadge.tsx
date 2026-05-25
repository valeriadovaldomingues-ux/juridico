import { cn } from '@/lib/utils'

type Variant =
  | 'ativo'   | 'pendente' | 'concluido' | 'cancelado'
  | 'suspenso'| 'arquivado'| 'encerrado'
  | 'receita' | 'despesa'
  | 'pago'    | 'vencido'
  | 'novo'    | 'fechado'  | 'perdido'
  | 'neutro'

const CONFIG: Record<Variant, { label: string; classes: string }> = {
  ativo:     { label: 'Ativo',      classes: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  pendente:  { label: 'Pendente',   classes: 'bg-[var(--color-gold-light)] text-[var(--color-gold-muted)] border-[#E7CBA8]'  },
  concluido: { label: 'Concluído',  classes: 'bg-[var(--color-petrol-light)] text-[var(--color-petrol)] border-[#CBD9DF]'  },
  cancelado: { label: 'Cancelado',  classes: 'bg-rose-50   text-rose-700   border-rose-100'   },
  suspenso:  { label: 'Suspenso',   classes: 'bg-orange-50 text-orange-700 border-orange-100' },
  arquivado: { label: 'Arquivado',  classes: 'bg-[var(--color-surface-warm)] text-[var(--color-ink-3)] border-[var(--color-border)]'  },
  encerrado: { label: 'Encerrado',  classes: 'bg-[var(--color-surface-warm)] text-[var(--color-ink-2)] border-[var(--color-border)]'  },
  receita:   { label: 'Receita',    classes: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  despesa:   { label: 'Despesa',    classes: 'bg-rose-50   text-rose-700   border-rose-100'   },
  pago:      { label: 'Pago',       classes: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  vencido:   { label: 'Vencido',    classes: 'bg-rose-50   text-rose-700   border-rose-100'   },
  novo:      { label: 'Novo',       classes: 'bg-[var(--color-petrol-light)] text-[var(--color-petrol)] border-[#CBD9DF]'   },
  fechado:   { label: 'Fechado',    classes: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  perdido:   { label: 'Perdido',    classes: 'bg-rose-50   text-rose-700   border-rose-100'   },
  neutro:    { label: '',           classes: 'bg-[var(--color-surface-warm)] text-[var(--color-ink-2)] border-[var(--color-border)]'  },
}

interface Props {
  variant?:  Variant
  label?:    string       // override do label
  className?: string
  size?:     'sm' | 'md'
}

/**
 * Badge de status semântico do sistema interno.
 * Consistente em todas as tabelas e cards.
 */
export default function StatusBadge({ variant = 'neutro', label, className, size = 'md' }: Props) {
  const cfg = CONFIG[variant] ?? CONFIG.neutro
  const txt = label ?? cfg.label

  return (
    <span className={cn(
      'inline-flex items-center border font-medium rounded-full',
      size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5',
      cfg.classes,
      className,
    )}>
      {txt}
    </span>
  )
}
