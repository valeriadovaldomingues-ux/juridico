'use client'

/**
 * Componente de logo do sistema Pessoa e do Val.
 *
 * Variantes:
 *   - "sidebar"  → logo + nome do sistema (uso na barra lateral)
 *   - "login"    → logo centralizada + nome (uso na tela de login)
 *   - "icon"     → só o ícone/logo, sem texto (uso compacto)
 *   - "complete" → assinatura completa horizontal/vertical conforme asset oficial
 *   - "compact"  → assinatura compacta
 */

type LogoVariant = 'sidebar' | 'login' | 'icon' | 'complete' | 'compact'
type LogoTone = 'dark' | 'light'

const LOGO_SRC = '/logo-pedv-tv.jpeg'

function LogoImg({
  className,
  height,
  width,
}: {
  className?: string
  height: number
  width: number
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt="Pessoa e do Val Advocacia Empresarial"
      width={width}
      height={height}
      className={className}
    />
  )
}

export default function Logo({
  variant = 'sidebar',
  tone = 'dark',
}: {
  variant?: LogoVariant
  tone?: LogoTone
}) {
  const textPrimary = tone === 'light' ? 'text-white' : 'text-[var(--color-ink)]'
  const textAccent = tone === 'light' ? 'text-[var(--color-copper)]' : 'text-[var(--color-gold-muted)]'

  if (variant === 'icon') {
    return (
      <div className="w-9 h-9 rounded-xl border border-[var(--color-copper)]/30 bg-[var(--color-sidebar-deep)] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
        <LogoImg height={36} width={36} className="h-full w-full object-cover" />
      </div>
    )
  }

  if (variant === 'complete' || variant === 'compact') {
    return (
      <div className="inline-flex items-center gap-3">
        <LogoImg
          height={variant === 'complete' ? 64 : 44}
          width={variant === 'complete' ? 180 : 120}
          className={variant === 'complete' ? 'h-14 w-auto object-contain' : 'h-10 w-auto object-contain'}
        />
      </div>
    )
  }

  if (variant === 'sidebar') {
    return (
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg border border-[var(--color-copper)]/25 bg-[var(--color-copper)]/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
          <LogoImg height={36} width={36} className="h-full w-full object-cover" />
        </div>
        <div>
          <p className="font-brand text-white font-semibold text-[17px] leading-none">Pessoa e do Val</p>
          <p className="text-[var(--color-copper)]/70 text-[8px] mt-0.5 tracking-[0.16em] uppercase">Advocacia Empresarial</p>
        </div>
      </div>
    )
  }

  // variant === 'login'
  return (
    <div className="inline-flex flex-col items-center gap-3">
      <div className="h-20 w-20 rounded-2xl bg-[var(--color-sidebar)] flex items-center justify-center shadow-lg overflow-hidden border border-[var(--color-border)]">
        <LogoImg height={80} width={80} className="h-full w-full object-cover" />
      </div>
      <div className="text-center">
        <h1 className={`font-brand text-[22px] font-semibold leading-none ${textPrimary}`}>Pessoa e do Val</h1>
        <p className={`text-[10px] mt-1 tracking-[0.16em] uppercase ${textAccent}`}>Advocacia Empresarial</p>
      </div>
    </div>
  )
}
