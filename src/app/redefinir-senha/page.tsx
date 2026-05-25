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
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-[var(--color-petrol-light)] to-transparent pointer-events-none" />
      <div className="absolute -right-28 bottom-0 h-72 w-72 rounded-full border border-[var(--color-copper)]/10 pointer-events-none" />
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
              Definir nova senha
            </h1>
            <p className="text-[13px] text-[var(--color-ink-3)] mt-2">
              Crie uma nova senha para acessar o sistema do Pessoa e do Val Advocacia.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--color-ink-2)] mb-1.5 uppercase tracking-[0.14em]">
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
                  className="w-full px-3.5 py-3 pr-10 rounded-xl border border-[var(--color-border)] text-[13px] text-[var(--color-ink)] outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/15 transition-all placeholder:text-[var(--color-ink-muted)] bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)] hover:text-[var(--color-copper)] transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar nova senha' : 'Mostrar nova senha'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--color-ink-2)] mb-1.5 uppercase tracking-[0.14em]">
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
                  className="w-full px-3.5 py-3 pr-10 rounded-xl border border-[var(--color-border)] text-[13px] text-[var(--color-ink)] outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/15 transition-all placeholder:text-[var(--color-ink-muted)] bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)] hover:text-[var(--color-copper)] transition-colors"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'}
                >
                  {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-[13px] text-[#9F2F24] bg-[#FFF0EC] border border-[#F2C7BD] px-3.5 py-2.5 rounded-xl">
                {error}
              </div>
            )}

            {success && (
              <div className="text-[13px] text-[var(--color-petrol)] bg-[var(--color-petrol-light)] border border-[var(--color-border)] px-3.5 py-2.5 rounded-xl">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || checkingLink}
              className="w-full py-3 px-4 bg-[var(--color-sidebar)] hover:bg-[var(--color-petrol)] text-white text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 tracking-[0.04em] shadow-sm"
            >
              {checkingLink ? 'Validando link...' : loading ? 'Salvando...' : 'Redefinir senha'}
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
