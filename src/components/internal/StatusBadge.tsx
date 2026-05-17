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
  pendente:  { label: 'Pendente',   classes: 'bg-amber-50  text-amber-700  border-amber-100'  },
  concluido: { label: 'Concluído',  classes: 'bg-[#E8F2F2] text-[#1D5F60] border-[#BCE4E4]'  },
  cancelado: { label: 'Cancelado',  classes: 'bg-rose-50   text-rose-700   border-rose-100'   },
  suspenso:  { label: 'Suspenso',   classes: 'bg-orange-50 text-orange-700 border-orange-100' },
  arquivado: { label: 'Arquivado',  classes: 'bg-[#F3F1EE] text-[#9CA3AF] border-[#E2DDD8]'  },
  encerrado: { label: 'Encerrado',  classes: 'bg-[#F3F1EE] text-[#6B7280] border-[#E2DDD8]'  },
  receita:   { label: 'Receita',    classes: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  despesa:   { label: 'Despesa',    classes: 'bg-rose-50   text-rose-700   border-rose-100'   },
  pago:      { label: 'Pago',       classes: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  vencido:   { label: 'Vencido',    classes: 'bg-rose-50   text-rose-700   border-rose-100'   },
  novo:      { label: 'Novo',       classes: 'bg-blue-50   text-blue-700   border-blue-100'   },
  fechado:   { label: 'Fechado',    classes: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  perdido:   { label: 'Perdido',    classes: 'bg-rose-50   text-rose-700   border-rose-100'   },
  neutro:    { label: '',           classes: 'bg-[#F3F1EE] text-[#6B7280] border-[#E2DDD8]'  },
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
