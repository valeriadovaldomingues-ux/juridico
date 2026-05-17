import { cn } from '@/lib/utils'

interface Props {
  titulo:    string
  subtitulo?: string
  children?: React.ReactNode  // ações (botões, filtros)
  className?: string
}

/**
 * Cabeçalho de página do sistema interno.
 * Título + subtítulo à esquerda, ações à direita.
 */
export default function PageHeader({ titulo, subtitulo, children, className }: Props) {
  return (
    <div className={cn('flex items-center justify-between gap-4 flex-wrap mb-5', className)}>
      <div>
        <h1 className="text-[18px] font-semibold text-[#111827] tracking-tight leading-none">
          {titulo}
        </h1>
        {subtitulo && (
          <p className="text-[12px] text-[#9CA3AF] mt-1">{subtitulo}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {children}
        </div>
      )}
    </div>
  )
}
