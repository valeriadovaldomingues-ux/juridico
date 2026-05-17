import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  icon:       LucideIcon
  titulo:     string
  descricao?: string
  acao?:      React.ReactNode  // botão ou link de ação
  className?: string
}

/**
 * Estado vazio operacional do sistema interno.
 * Informativo e acionável — sem excesso decorativo.
 */
export default function EmptyState({ icon: Icon, titulo, descricao, acao, className }: Props) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-14 px-6 text-center',
      className,
    )}>
      <div className="w-10 h-10 rounded-xl bg-[#F3F1EE] border border-[#E2DDD8] flex items-center justify-center mb-3">
        <Icon size={18} className="text-[#CBC5BC]" strokeWidth={1.5} />
      </div>
      <p className="text-[13px] font-medium text-[#4B5563] mb-1">{titulo}</p>
      {descricao && (
        <p className="text-[12px] text-[#9CA3AF] leading-relaxed max-w-[280px]">{descricao}</p>
      )}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}
