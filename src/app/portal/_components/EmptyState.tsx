import type { LucideIcon } from 'lucide-react'

interface Props {
  icon:      LucideIcon
  titulo:    string
  descricao: string
}

/**
 * Estado vazio institucional para páginas do portal.
 * Minimalista, com acento dourado discreto — sem ilustrações chamativas.
 */
export default function EmptyState({ icon: Icon, titulo, descricao }: Props) {
  return (
    <div className="bg-white border border-[#E8E3D8] py-16 px-8 text-center">

      {/* Linha fina acima do ícone */}
      <div className="w-px h-7 bg-gradient-to-b from-transparent to-[#DDD8D0] mx-auto mb-5" />

      {/* Ícone em quadrado refinado */}
      <div className="w-10 h-10 border border-[#E8E3D8] flex items-center justify-center mx-auto mb-4">
        <Icon size={17} className="text-[#C5C0B8]" strokeWidth={1} />
      </div>

      <p className="text-[13px] text-[#6B7280] font-medium mb-1.5 tracking-tight">
        {titulo}
      </p>
      <p className="text-[11px] text-[#9CA3AF] leading-relaxed max-w-[220px] mx-auto">
        {descricao}
      </p>

      {/* Linha dourada discreta abaixo */}
      <div className="w-8 h-px bg-[#C49557]/25 mx-auto mt-7" />
    </div>
  )
}
