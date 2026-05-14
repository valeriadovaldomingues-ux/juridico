'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/ui/Logo'
import { Mail, Loader2, CheckCircle2 } from 'lucide-react'

// Estados possíveis da tela
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

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/portal`,
        // Garante que somente clientes com vínculo existente recebem o link
        // O redirect_to aponta para o portal, não para o dashboard
        shouldCreateUser: false,
      },
    })

    if (error) {
      // shouldCreateUser: false retorna erro se o email não existir como usuário
      // Usamos mensagem genérica para não revelar se o email está cadastrado
      setErro('Não foi possível enviar o link. Verifique o e-mail ou entre em contato com o escritório.')
      setEstado('erro')
      return
    }

    setEstado('enviado')
  }

  return (
    <div className="min-h-screen bg-[#F7F9F9] flex items-center justify-center p-4">
      <div className="w-full max-w-[380px]">

        <div className="flex justify-center mb-8">
          <Logo variant="login" />
        </div>

        <div className="bg-white rounded-2xl border border-[#D0DCDC] shadow-[0_2px_16px_rgba(0,0,0,0.06)] p-8">

          {estado === 'enviado' ? (

            // ── Confirmação de envio ──────────────────────────────────────────
            <div className="text-center space-y-4">
              <CheckCircle2 size={40} className="mx-auto text-[#2ecc71]" />
              <h2 className="text-[15px] font-semibold text-[#0f1923]">
                Link enviado!
              </h2>
              <p className="text-[13px] text-[#7a8899] leading-relaxed">
                Verifique sua caixa de entrada em{' '}
                <span className="font-medium text-[#0f1923]">{email}</span>{' '}
                e clique no link para acessar o portal.
              </p>
              <p className="text-[11px] text-[#a8b3c4]">
                O link expira em 1 hora. Se não receber, verifique a pasta de spam.
              </p>
              <button
                onClick={() => { setEstado('form'); setEmail('') }}
                className="text-[12px] text-[#145A5B] font-semibold hover:underline"
              >
                Usar outro e-mail
              </button>
            </div>

          ) : (

            // ── Formulário ────────────────────────────────────────────────────
            <>
              <h2 className="text-[16px] font-semibold text-[#0f1923] mb-1">
                Portal do Cliente
              </h2>
              <p className="text-[13px] text-[#7a8899] mb-6">
                Informe seu e-mail para receber o link de acesso.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[#3d4a5c] mb-1.5 uppercase tracking-wide">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a8b3c4]" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      autoFocus
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[#D0DCDC] text-[13px] text-[#0f1923] outline-none focus:border-[#145A5B] focus:ring-2 focus:ring-[#145A5B]/10 transition-all placeholder:text-[#a8b3c4] bg-[#fafbfc]"
                    />
                  </div>
                </div>

                {estado === 'erro' && (
                  <div className="text-[13px] text-[#a93226] bg-[#fde8e8] border border-[#f5c6c6] px-3.5 py-2.5 rounded-xl">
                    {erro}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={estado === 'enviando' || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#0F3D3E] hover:bg-[#145A5B] text-white text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {estado === 'enviando' ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    'Enviar link de acesso'
                  )}
                </button>
              </form>

              <p className="text-center text-[11px] text-[#a8b3c4] mt-5">
                Acesso exclusivo para clientes cadastrados.
                <br />
                Problemas? Entre em contato com o escritório.
              </p>
            </>

          )}
        </div>

        <p className="text-center text-[11px] text-[#a8b3c4] mt-6">
          © {new Date().getFullYear()} PEDV · Todos os direitos reservados
        </p>
      </div>
    </div>
  )
}
