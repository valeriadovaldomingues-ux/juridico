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
 * Superfície quente, borda institucional e sombra discreta.
 */
export default function InternalCard({ children, className, accent, flush, padding }: Props) {
  return (
    <div
      className={cn(
        'bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-[0_8px_24px_rgba(20,32,51,0.045)] overflow-hidden',
        accent && 'border-t-2 border-t-[var(--color-copper)]',
        !flush && (padding ?? 'p-5'),
        className,
      )}
    >
      {children}
    </div>
  )
}
