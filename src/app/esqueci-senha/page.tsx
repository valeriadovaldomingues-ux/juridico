'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import Logo from '@/components/ui/Logo'
import { createClient } from '@/lib/supabase/client'
import {
  PASSWORD_RESET_GENERIC_MESSAGE,
  requestPasswordResetEmail,
} from '@/lib/auth/password-reset'

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    const supabase = createClient()
    const result = await requestPasswordResetEmail(
      supabase.auth,
      email,
      window.location.origin
    )

    if (result.failed && process.env.NODE_ENV === 'development') {
      console.warn('[auth] Falha ao solicitar redefinição de senha. Mensagem genérica exibida ao usuário.', {
        error: result.error,
      })
    }

    setMessage(PASSWORD_RESET_GENERIC_MESSAGE)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-[var(--color-petrol-light)] to-transparent pointer-events-none" />
      <div className="absolute -left-28 bottom-0 h-72 w-72 rounded-full border border-[var(--color-copper)]/10 pointer-events-none" />
      <div className="w-full max-w-[430px] relative">
        <div className="flex justify-center mb-8">
          <Logo variant="login" />
        </div>

        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-[0_24px_70px_rgba(13,34,53,0.10)] p-7 sm:p-8">
          <div className="mb-6 border-b border-[var(--color-border)] pb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-copper)] mb-2">
              Segurança de acesso
            </p>
            <h1 className="font-brand text-[28px] font-semibold leading-none text-[var(--color-ink)]">
              Recuperar senha
            </h1>
            <p className="text-[13px] text-[var(--color-ink-3)] mt-2">
              Informe seu e-mail para receber as instruções de redefinição.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--color-ink-2)] mb-1.5 uppercase tracking-[0.14em]">
                E-mail
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full px-3.5 py-3 pr-10 rounded-xl border border-[var(--color-border)] text-[13px] text-[var(--color-ink)] outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/15 transition-all placeholder:text-[var(--color-ink-muted)] bg-white"
                />
                <Mail
                  size={15}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)]"
                  aria-hidden="true"
                />
              </div>
            </div>

            {message && (
              <div className="text-[13px] text-[var(--color-petrol)] bg-[var(--color-petrol-light)] border border-[var(--color-border)] px-3.5 py-2.5 rounded-xl">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[var(--color-sidebar)] hover:bg-[var(--color-petrol)] text-white text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 tracking-[0.04em] shadow-sm"
            >
              {loading ? 'Enviando...' : 'Enviar instruções'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link
              href="/login"
              className="text-[12px] font-semibold text-[var(--color-gold-muted)] hover:text-[var(--color-copper-hover)] transition-colors"
            >
              Voltar para o login
            </Link>
          </div>
        </div>

        <p className="text-center text-[11px] text-[var(--color-ink-3)] mt-6">
          © {new Date().getFullYear()} Pessoa e do Val Advocacia Empresarial
        </p>
      </div>
    </div>
  )
}
