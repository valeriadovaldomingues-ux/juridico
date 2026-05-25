'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ROLE_REDIRECT } from '@/lib/permissions'
import type { UserRole } from '@/types'
import Logo from '@/components/ui/Logo'
import { sanitizeAuthError } from '@/lib/auth/password-reset'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[auth] Falha no login por senha.', {
          error: sanitizeAuthError(error),
          origin: window.location.origin,
        })
      }
      setError('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }

    // Busca o perfil para redirecionar conforme o papel
    let redirect = '/dashboard'
    if (authData.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single()
      if (profile?.role) {
        redirect = ROLE_REDIRECT[profile.role as UserRole] ?? '/dashboard'
      }
    }

    router.push(redirect)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-[var(--color-petrol-light)] to-transparent pointer-events-none" />
      <div className="absolute -right-28 -top-28 h-72 w-72 rounded-full border border-[var(--color-copper)]/10 pointer-events-none" />
      <div className="w-full max-w-[420px] relative">

        <div className="flex justify-center mb-8">
          <Logo variant="login" />
        </div>

        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-[0_24px_70px_rgba(13,34,53,0.10)] p-7 sm:p-8">
          <div className="mb-6 border-b border-[var(--color-border)] pb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-copper)] mb-2">
              Sistema interno
            </p>
            <h2 className="font-brand text-[28px] font-semibold leading-none text-[var(--color-ink)]">
              Acesso ao sistema
            </h2>
            <p className="text-[13px] text-[var(--color-ink-3)] mt-2">
              Entre com suas credenciais para continuar.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--color-ink-2)] mb-1.5 uppercase tracking-[0.14em]">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full px-3.5 py-3 rounded-xl border border-[var(--color-border)] text-[13px] text-[var(--color-ink)] outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/15 transition-all placeholder:text-[var(--color-ink-muted)] bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--color-ink-2)] mb-1.5 uppercase tracking-[0.14em]">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3.5 py-3 pr-10 rounded-xl border border-[var(--color-border)] text-[13px] text-[var(--color-ink)] outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/15 transition-all placeholder:text-[var(--color-ink-muted)] bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)] hover:text-[var(--color-copper)] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-[13px] text-[#9F2F24] bg-[#FFF0EC] border border-[#F2C7BD] px-3.5 py-2.5 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[var(--color-sidebar)] hover:bg-[var(--color-petrol)] text-white text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 tracking-[0.04em] shadow-sm"
            >
              {loading ? 'Verificando...' : 'Entrar'}
            </button>

            <div className="text-center">
              <Link
                href="/esqueci-senha"
                className="text-[12px] font-semibold text-[var(--color-gold-muted)] hover:text-[var(--color-copper-hover)] transition-colors"
              >
                Esqueci minha senha
              </Link>
            </div>
          </form>
        </div>

        <p className="text-center text-[11px] text-[var(--color-ink-3)] mt-6">
          © {new Date().getFullYear()} Pessoa e do Val Advocacia Empresarial
        </p>
      </div>
    </div>
  )
}
