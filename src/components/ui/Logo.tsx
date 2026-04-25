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
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#b8903a] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
          <LogoImg size={36} />
        </div>
        <div>
          <p className="text-[#d4a94e] font-semibold text-[13px] leading-none tracking-tight">PEDV</p>
          <p className="text-white/35 text-[10px] mt-1 tracking-wide uppercase">Sistema Jurídico</p>
        </div>
      </div>
    )
  }

  // variant === 'login'
  return (
    <div className="inline-flex flex-col items-center gap-3">
      <div className="w-16 h-16 rounded-2xl bg-[#0F3D3E] flex items-center justify-center shadow-lg overflow-hidden">
        <LogoImg size={64} padding="p-1.5" />
      </div>
      <div className="text-center">
        <h1 className="text-[18px] font-bold text-[#0f1923] tracking-tight">PEDV</h1>
        <p className="text-[12px] text-[#7a8899] mt-0.5 tracking-wide uppercase">Sistema Jurídico</p>
      </div>
    </div>
  )
}
