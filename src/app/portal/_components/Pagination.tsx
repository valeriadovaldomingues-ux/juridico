import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  page:       number  // página atual (1-indexed)
  total:      number  // total de itens
  pageSize:   number  // itens por página
  basePath:   string
  extraParams?: Record<string, string>
}

/**
 * Paginação prev/next com URL params — Server Component puro.
 * Só renderiza quando há mais de uma página.
 */
export default function Pagination({ page, total, pageSize, basePath, extraParams = {} }: Props) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  const hasPrev = page > 1
  const hasNext = page < totalPages

  function pageHref(p: number) {
    const params = new URLSearchParams(extraParams)
    if (p > 1) params.set('page', String(p))
    else       params.delete('page')
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between pt-1">
      <span className="text-[10px] text-[#9CA3AF] tabular-nums tracking-wide">
        {from}–{to} de {total}
      </span>

      <div className="flex items-center gap-1">
        {hasPrev ? (
          <Link
            href={pageHref(page - 1)}
            className="w-8 h-8 border border-[#E8E3D8] flex items-center justify-center text-[#6B7280] hover:border-[#C49557]/40 hover:text-[#C49557] transition-all duration-150"
          >
            <ChevronLeft size={13} />
          </Link>
        ) : (
          <span className="w-8 h-8 border border-[#F0EBE4] flex items-center justify-center text-[#D1CCC5]">
            <ChevronLeft size={13} />
          </span>
        )}

        <span className="text-[10px] text-[#6B7280] px-2 tabular-nums">
          {page} / {totalPages}
        </span>

        {hasNext ? (
          <Link
            href={pageHref(page + 1)}
            className="w-8 h-8 border border-[#E8E3D8] flex items-center justify-center text-[#6B7280] hover:border-[#C49557]/40 hover:text-[#C49557] transition-all duration-150"
          >
            <ChevronRight size={13} />
          </Link>
        ) : (
          <span className="w-8 h-8 border border-[#F0EBE4] flex items-center justify-center text-[#D1CCC5]">
            <ChevronRight size={13} />
          </span>
        )}
      </div>
    </div>
  )
}
