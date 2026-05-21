'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import Logo from '@/components/ui/Logo'
import { createClient } from '@/lib/supabase/client'
import { updatePasswordWithConfirmation } from '@/lib/auth/password-reset'

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingLink, setCheckingLink] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const code = new URLSearchParams(window.location.search).get('code')

    async function prepareSession() {
      if (!code) {
        setCheckingLink(false)
        return
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      if (exchangeError) {
        setError('Link inválido ou expirado. Solicite uma nova redefinição de senha.')
      } else {
        window.history.replaceState(null, '', '/redefinir-senha')
      }
      setCheckingLink(false)
    }

    void prepareSession()
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    const supabase = createClient()
    const result = await updatePasswordWithConfirmation(
      supabase.auth,
      password,
      confirmPassword
    )

    if (!result.ok) {
      setError(result.error)
      setLoading(false)
      return
    }

    setSuccess('Senha redefinida com sucesso. Redirecionando para o login...')
    setLoading(false)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#F7F9F9] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="flex justify-center mb-8">
          <Logo variant="login" />
        </div>

        <div className="bg-white rounded-2xl border border-[#D0DCDC] shadow-[0_2px_16px_rgba(0,0,0,0.06)] p-8">
          <h1 className="text-[18px] font-semibold text-[#0f1923] mb-1">Definir nova senha</h1>
          <p className="text-[13px] text-[#7a8899] mb-6">
            Crie uma nova senha para acessar o sistema do Pessoa e do Val Advocacia.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-[#3d4a5c] mb-1.5 uppercase tracking-wide">
                Nova senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  required
                  minLength={6}
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#D0DCDC] text-[13px] text-[#0f1923] outline-none focus:border-[#1D5F60] focus:ring-2 focus:ring-[#1D5F60]/10 transition-all placeholder:text-[#a8b3c4] bg-[#fafbfc]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a8b3c4] hover:text-[#7a8899] transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar nova senha' : 'Mostrar nova senha'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#3d4a5c] mb-1.5 uppercase tracking-wide">
                Confirmar nova senha
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repita a nova senha"
                  required
                  minLength={6}
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#D0DCDC] text-[13px] text-[#0f1923] outline-none focus:border-[#1D5F60] focus:ring-2 focus:ring-[#1D5F60]/10 transition-all placeholder:text-[#a8b3c4] bg-[#fafbfc]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a8b3c4] hover:text-[#7a8899] transition-colors"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'}
                >
                  {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-[13px] text-[#a93226] bg-[#fde8e8] border border-[#f5c6c6] px-3.5 py-2.5 rounded-xl">
                {error}
              </div>
            )}

            {success && (
              <div className="text-[13px] text-[#1D5F60] bg-[#eef8f6] border border-[#cfe7e1] px-3.5 py-2.5 rounded-xl">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || checkingLink}
              className="w-full py-2.5 px-4 bg-[#162030] hover:bg-[#1D5F60] text-white text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 tracking-wide"
            >
              {checkingLink ? 'Validando link...' : loading ? 'Salvando...' : 'Redefinir senha'}
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
