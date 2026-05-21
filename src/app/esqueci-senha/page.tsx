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
    <div className="min-h-screen bg-[#F7F9F9] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="flex justify-center mb-8">
          <Logo variant="login" />
        </div>

        <div className="bg-white rounded-2xl border border-[#D0DCDC] shadow-[0_2px_16px_rgba(0,0,0,0.06)] p-8">
          <h1 className="text-[18px] font-semibold text-[#0f1923] mb-1">Recuperar senha</h1>
          <p className="text-[13px] text-[#7a8899] mb-6">
            Informe seu e-mail para receber as instruções de redefinição.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-[#3d4a5c] mb-1.5 uppercase tracking-wide">
                E-mail
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#D0DCDC] text-[13px] text-[#0f1923] outline-none focus:border-[#1D5F60] focus:ring-2 focus:ring-[#1D5F60]/10 transition-all placeholder:text-[#a8b3c4] bg-[#fafbfc]"
                />
                <Mail
                  size={15}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a8b3c4]"
                  aria-hidden="true"
                />
              </div>
            </div>

            {message && (
              <div className="text-[13px] text-[#1D5F60] bg-[#eef8f6] border border-[#cfe7e1] px-3.5 py-2.5 rounded-xl">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#162030] hover:bg-[#1D5F60] text-white text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 tracking-wide"
            >
              {loading ? 'Enviando...' : 'Enviar instruções'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link
              href="/login"
              className="text-[12px] font-semibold text-[#1D5F60] hover:text-[#162030] transition-colors"
            >
              Voltar para o login
            </Link>
          </div>
        </div>

        <p className="text-center text-[11px] text-[#a8b3c4] mt-6">
          © {new Date().getFullYear()} PEDV · Todos os direitos reservados
        </p>
      </div>
    </div>
  )
}
