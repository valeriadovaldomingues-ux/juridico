'use client'

import { useState }  from 'react'
import { Mail, Loader2, CheckCircle2, ArrowRight } from 'lucide-react'
import Logo from '@/components/ui/Logo'

type Estado = 'form' | 'enviando' | 'enviado' | 'erro'

export default function PortalLoginPage() {
  const [email,  setEmail]  = useState('')
  const [estado, setEstado] = useState<Estado>('form')
  const [erro,   setErro]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setEstado('enviando')
    setErro('')

    const res = await fetch('/api/portal/auth/otp', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: email.trim().toLowerCase() }),
    })

    if (res.status === 429) {
      const data = await res.json().catch(() => ({}))
      setErro(data.error ?? 'Muitas tentativas. Aguarde e tente novamente.')
      setEstado('erro')
      return
    }

    setEstado('enviado')
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, var(--color-sidebar) 0%, var(--color-sidebar-deep) 65%, #06111B 100%)' }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-copper)]/60 to-transparent" />
      <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full border border-[var(--color-copper)]/10 pointer-events-none" />
      <div className="absolute -left-28 bottom-10 h-72 w-72 rounded-full border border-white/5 pointer-events-none" />

      <div className="text-center mb-10">
        <Logo variant="login" tone="light" />
      </div>

      <div className="w-full max-w-[410px] relative">
        <div
          className="border border-white/10 p-7 sm:p-8 rounded-2xl shadow-[0_30px_90px_rgba(0,0,0,0.22)]"
          style={{ background: 'rgba(252,250,247,0.06)', backdropFilter: 'blur(14px)' }}
        >
          {estado === 'enviado' ? (

            /* ── Confirmação ─────────────────────────────────────────────── */
            <div className="text-center space-y-4 py-4">
              <CheckCircle2 size={36} className="mx-auto text-[var(--color-copper)]" strokeWidth={1.5} />
              <div>
                <h2 className="font-brand text-white text-[28px] leading-none mb-3 font-semibold">
                  Link enviado
                </h2>
                <p className="text-white/50 text-[13px] leading-relaxed">
                  Verifique sua caixa de entrada em{' '}
                  <span className="text-white/80">{email}</span>{' '}
                  e clique no link para acessar o portal.
                </p>
              </div>
              <p className="text-white/25 text-[11px]">
                O link expira em 1 hora.
              </p>
              <button
                onClick={() => { setEstado('form'); setEmail('') }}
                className="text-[11px] text-[var(--color-copper)]/80 hover:text-[var(--color-copper)] tracking-wider uppercase transition-colors"
              >
                Usar outro e-mail
              </button>
            </div>

          ) : (

            /* ── Formulário ──────────────────────────────────────────────── */
            <>
              <div className="mb-7">
                <p className="text-[10px] text-[var(--color-copper)] mb-2 tracking-[0.22em] uppercase">
                  Portal reservado
                </p>
                <h2 className="font-brand text-white text-[30px] leading-none mb-2 font-semibold">
                  Área do cliente
                </h2>
                <p className="text-white/40 text-[12px] tracking-wide">
                  Informe seu e-mail para receber o link de acesso.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">

                <div>
                  <label className="block text-[9px] text-[var(--color-copper)] mb-2 tracking-[0.2em] uppercase">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu@email.com.br"
                      required
                      autoFocus
                      className="w-full pl-9 pr-4 py-3 bg-white/6 border border-white/10 rounded-xl text-white text-[13px] outline-none placeholder:text-white/20 focus:border-[var(--color-copper)]/70 focus:ring-2 focus:ring-[var(--color-copper)]/15 transition-colors"
                    />
                  </div>
                </div>

                {estado === 'erro' && (
                  <p className="text-[12px] text-[#FFD5CC]/90 bg-[#e74c3c]/10 border border-[#e74c3c]/20 px-3 py-2 rounded-xl">
                    {erro}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={estado === 'enviando' || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[var(--color-copper)] hover:bg-[var(--color-copper-hover)] text-white text-[11px] tracking-[0.15em] uppercase font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {estado === 'enviando' ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <>
                      Acessar portal
                      <ArrowRight size={13} />
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-[10px] text-white/20 mt-6 tracking-wide leading-relaxed">
                Acesso exclusivo para clientes cadastrados.
                <br />
                Dúvidas? Entre em contato com o escritório.
              </p>
            </>

          )}
        </div>
      </div>

      {/* Linha decorativa inferior + assinatura */}
      <div className="mt-10 flex flex-col items-center gap-3">
        <div className="w-16 h-px bg-[var(--color-copper)] opacity-30" />
        <p className="text-[9px] text-white/20 tracking-[0.2em] uppercase">
          P&amp;V · Pessoa e do Val Advocacia Empresarial
        </p>
      </div>
    </div>
  )
}
