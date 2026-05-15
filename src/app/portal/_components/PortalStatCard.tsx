import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'

interface Props {
  icon:     LucideIcon
  label:    string
  value:    number | string
  href:     string
  accent?:  boolean  // destaque dourado quando há itens a atenção
  alert?:   boolean  // alerta vermelho/âmbar
}

export default function PortalStatCard({ icon: Icon, label, value, href, accent, alert }: Props) {
  const hasValue = typeof value === 'number' ? value > 0 : !!value

  return (
    <Link
      href={href}
      className={`group relative bg-white border flex flex-col gap-3 p-5 transition-all duration-200 hover:shadow-sm overflow-hidden ${
        alert  ? 'border-amber-200 hover:border-amber-300' :
        accent && hasValue ? 'border-[#C49557]/30 hover:border-[#C49557]/50' :
        'border-[#E8E3D8] hover:border-[#C49557]/25'
      }`}
    >
      {/* Linha dourada superior — aparece quando há atenção */}
      {(accent && hasValue) || alert ? (
        <div className={`absolute top-0 left-0 right-0 h-[2px] ${alert ? 'bg-amber-400' : 'bg-[#C49557]'}`} />
      ) : null}

      {/* Ícone + valor */}
      <div className="flex items-start justify-between">
        <div className={`w-8 h-8 border flex items-center justify-center transition-colors duration-200 ${
          alert ? 'border-amber-200 bg-amber-50' :
          accent && hasValue ? 'border-[#C49557]/30 bg-[#FDFAF7]' :
          'border-[#E8E3D8] group-hover:border-[#C49557]/30'
        }`}>
          <Icon
            size={14}
            strokeWidth={1.5}
            className={
              alert ? 'text-amber-600' :
              accent && hasValue ? 'text-[#C49557]' :
              'text-[#9CA3AF] group-hover:text-[#C49557] transition-colors duration-200'
            }
          />
        </div>

        <span className={`text-[28px] leading-none font-semibold tabular-nums tracking-tight ${
          alert ? 'text-amber-700' :
          accent && hasValue ? 'text-[#C49557]' :
          'text-[#1C1C2E]'
        }`} style={{ fontFamily: 'var(--font-serif)' }}>
          {value}
        </span>
      </div>

      {/* Label */}
      <p className="text-[10px] text-[#9CA3AF] tracking-[0.08em] uppercase font-medium">{label}</p>
    </Link>
  )
}
