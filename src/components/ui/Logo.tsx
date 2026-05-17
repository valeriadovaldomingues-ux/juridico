'use client'

/**
 * Componente de logo do sistema.
 * Lê de /public/logo.png — para trocar a logo, basta substituir esse arquivo.
 *
 * Variantes:
 *   - "sidebar"  → logo + nome do sistema (uso na barra lateral)
 *   - "login"    → logo centralizada + nome (uso na tela de login)
 *   - "icon"     → só o ícone/logo, sem texto (uso compacto)
 */

type LogoVariant = 'sidebar' | 'login' | 'icon'

function LogoImg({ size, padding = '' }: { size: number; padding?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Logo PEDV"
      width={size}
      height={size}
      className={`w-full h-full object-contain${padding ? ` ${padding}` : ''}`}
    />
  )
}

export default function Logo({ variant = 'sidebar' }: { variant?: LogoVariant }) {
  if (variant === 'icon') {
    return (
      <div className="w-9 h-9 rounded-xl bg-[#b8903a] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
        <LogoImg size={36} />
      </div>
    )
  }

  if (variant === 'sidebar') {
    return (
      <div className="flex items-center gap-2.5">
        {/* Ícone — borda sutil no dark sidebar */}
        <div className="w-8 h-8 rounded-lg bg-[#C49557]/15 border border-[#C49557]/25 flex items-center justify-center flex-shrink-0 overflow-hidden">
          <LogoImg size={32} padding="p-0.5" />
        </div>
        <div>
          <p className="text-white font-semibold text-[13px] leading-none tracking-tight">Pessoa e do Val</p>
          <p className="text-[#C49557]/50 text-[9px] mt-0.5 tracking-[0.1em] uppercase">Advocacia</p>
        </div>
      </div>
    )
  }

  // variant === 'login'
  return (
    <div className="inline-flex flex-col items-center gap-3">
      <div className="w-16 h-16 rounded-2xl bg-[#162030] flex items-center justify-center shadow-lg overflow-hidden border border-[#E2DDD8]">
        <LogoImg size={64} padding="p-1.5" />
      </div>
      <div className="text-center">
        <h1 className="text-[16px] font-semibold text-[#111827] tracking-tight">Pessoa e do Val</h1>
        <p className="text-[11px] text-[#9CA3AF] mt-0.5 tracking-[0.08em] uppercase">Sistema Jurídico</p>
      </div>
    </div>
  )
}
