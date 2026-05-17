import { cn } from '@/lib/utils'

interface Props {
  children:  React.ReactNode
  className?: string
  /** Destaque com borda superior gold */
  accent?:   boolean
  /** Sem padding (para tabelas que precisam de flush) */
  flush?:    boolean
  /** Padding personalizado */
  padding?:  string
}

/**
 * Card base do sistema interno.
 * Fundo branco, borda quente, sombra suave — denso e funcional.
 */
export default function InternalCard({ children, className, accent, flush, padding }: Props) {
  return (
    <div
      className={cn(
        'bg-white border border-[#E2DDD8] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden',
        accent && 'border-t-2 border-t-[#1D5F60]',
        !flush && (padding ?? 'p-5'),
        className,
      )}
    >
      {children}
    </div>
  )
}
