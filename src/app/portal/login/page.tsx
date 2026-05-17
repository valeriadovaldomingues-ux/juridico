'use client'

import { useState }  from 'react'
import { Cormorant_Garamond } from 'next/font/google'
import { Mail, Loader2, CheckCircle2, ArrowRight } from 'lucide-react'

const cormorant = Cormorant_Garamond({
  subsets:  ['latin'],
  weight:   ['300', '400', '600', '700'],
  style:    ['normal', 'italic'],
  display:  'swap',
})

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
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'linear-gradient(160deg, #0C1B2A 0%, #0A1520 60%, #07101A 100%)' }}
    >
      {/* Linha decorativa superior */}
      <div className="w-16 h-px bg-[#C49557] mb-10 opacity-60" />

      {/* Marca */}
      <div className="text-center mb-10">
        <h1
          className="text-white text-[36px] leading-none tracking-tight mb-2"
          style={{ fontFamily: cormorant.style.fontFamily, fontWeight: 600 }}
        >
          Pessoa e do Val
        </h1>
        <p className="text-[#C49557] text-[9px] tracking-[0.3em] uppercase">
          Advocacia
        </p>
      </div>

      {/* Card do formulário */}
      <div className="w-full max-w-[380px]">
        <div
          className="border border-white/8 p-8"
          style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)' }}
        >
          {estado === 'enviado' ? (

            /* ── Confirmação ─────────────────────────────────────────────── */
            <div className="text-center space-y-4 py-4">
              <CheckCircle2 size={36} className="mx-auto text-[#C49557]" strokeWidth={1.5} />
              <div>
                <h2
                  className="text-white text-[20px] mb-2"
                  style={{ fontFamily: cormorant.style.fontFamily, fontWeight: 600 }}
                >
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
                className="text-[11px] text-[#C49557]/70 hover:text-[#C49557] tracking-wider uppercase transition-colors"
              >
                Usar outro e-mail
              </button>
            </div>

          ) : (

            /* ── Formulário ──────────────────────────────────────────────── */
            <>
              <div className="mb-7">
                <h2
                  className="text-white text-[22px] leading-snug mb-1"
                  style={{ fontFamily: cormorant.style.fontFamily, fontWeight: 400 }}
                >
                  Área do cliente
                </h2>
                <p className="text-white/40 text-[12px] tracking-wide">
                  Informe seu e-mail para receber o link de acesso.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">

                <div>
                  <label className="block text-[9px] text-[#C49557] mb-2 tracking-[0.2em] uppercase">
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
                      className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 text-white text-[13px] outline-none placeholder:text-white/20 focus:border-[#C49557]/60 transition-colors"
                    />
                  </div>
                </div>

                {estado === 'erro' && (
                  <p className="text-[12px] text-[#e74c3c]/80 bg-[#e74c3c]/8 border border-[#e74c3c]/20 px-3 py-2">
                    {erro}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={estado === 'enviando' || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#C49557] hover:bg-[#A8803D] text-white text-[11px] tracking-[0.15em] uppercase font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
        <div className="w-16 h-px bg-[#C49557] opacity-30" />
        <p className="text-[9px] text-white/20 tracking-[0.2em] uppercase">
          P&amp;V · Belo Horizonte · Desde 2002
        </p>
      </div>
    </div>
  )
}
