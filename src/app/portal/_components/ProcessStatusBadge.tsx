interface Props {
  status: string
  size?: 'sm' | 'md'
}

const CONFIG: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  ativo:     { label: 'Ativo',     dot: 'bg-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-100' },
  suspenso:  { label: 'Suspenso',  dot: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-100'   },
  arquivado: { label: 'Arquivado', dot: 'bg-[#C5C0B8]',   text: 'text-[#6B7280]',  bg: 'bg-[#F5F2EE]',  border: 'border-[#E8E3D8]'   },
  encerrado: { label: 'Encerrado', dot: 'bg-[#9CA3AF]',   text: 'text-[#9CA3AF]',  bg: 'bg-[#F9F9F9]',  border: 'border-[#E8E3D8]'   },
}

export default function ProcessStatusBadge({ status, size = 'md' }: Props) {
  const c = CONFIG[status] ?? CONFIG.arquivado
  const cls = size === 'sm'
    ? 'text-[9px] px-1.5 py-0.5 gap-1'
    : 'text-[10px] px-2 py-1 gap-1.5'

  return (
    <span className={`inline-flex items-center border tracking-wide uppercase font-medium ${cls} ${c.text} ${c.bg} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}
