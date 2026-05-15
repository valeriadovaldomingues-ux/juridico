import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface FilterOption {
  label:    string
  value:    string    // valor do search param
  count?:   number    // badge de contagem opcional
}

interface Props {
  options:      FilterOption[]
  current:      string          // valor atual do filtro
  paramName:    string          // nome do search param (ex: 'status', 'tipo')
  basePath:     string          // pathname base (ex: '/portal/processos')
  extraParams?: Record<string, string>  // outros params a preservar
}

/**
 * Tabs de filtro baseadas em Link — Server Component puro.
 * Sem useSearchParams, sem Suspense, sem estado client-side.
 * Cada opção é um link que recarrega a página com o novo filtro.
 */
export default function FilterTabs({
  options, current, paramName, basePath, extraParams = {},
}: Props) {
  function href(value: string) {
    const params = new URLSearchParams(extraParams)
    if (value !== 'todos' && value !== '') {
      params.set(paramName, value)
    } else {
      params.delete(paramName)
    }
    // Ao mudar filtro, volta para página 1
    params.delete('page')
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {options.map(opt => {
        const active = opt.value === current ||
          (opt.value === 'todos' && (current === '' || current === 'todos'))
        return (
          <Link
            key={opt.value}
            href={href(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-[0.08em] uppercase font-medium border transition-all duration-150',
              active
                ? 'bg-[#C49557] text-white border-[#C49557]'
                : 'bg-white text-[#6B7280] border-[#E8E3D8] hover:border-[#C49557]/40 hover:text-[#1C1C2E]',
            )}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span className={cn(
                'text-[9px] tabular-nums font-semibold px-1 min-w-[16px] text-center',
                active ? 'text-white/70' : 'text-[#C5C0B8]',
              )}>
                {opt.count}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
