'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ROLE_REDIRECT } from '@/lib/permissions'
import type { UserRole } from '@/types'
import Logo from '@/components/ui/Logo'

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
    if (error) { setError('E-mail ou senha incorretos.'); setLoading(false); return }

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
    <div className="min-h-screen bg-[#F7F9F9] flex items-center justify-center p-4">
      <div className="w-full max-w-[380px]">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo variant="login" />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#D0DCDC] shadow-[0_2px_16px_rgba(0,0,0,0.06)] p-8">
          <h2 className="text-[16px] font-semibold text-[#0f1923] mb-1">Acesso ao sistema</h2>
          <p className="text-[13px] text-[#7a8899] mb-6">Entre com suas credenciais para continuar</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-[#3d4a5c] mb-1.5 uppercase tracking-wide">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D0DCDC] text-[13px] text-[#0f1923] outline-none focus:border-[#145A5B] focus:ring-2 focus:ring-[#145A5B]/10 transition-all placeholder:text-[#a8b3c4] bg-[#fafbfc]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#3d4a5c] mb-1.5 uppercase tracking-wide">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#D0DCDC] text-[13px] text-[#0f1923] outline-none focus:border-[#145A5B] focus:ring-2 focus:ring-[#145A5B]/10 transition-all placeholder:text-[#a8b3c4] bg-[#fafbfc]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a8b3c4] hover:text-[#7a8899] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-[13px] text-[#a93226] bg-[#fde8e8] border border-[#f5c6c6] px-3.5 py-2.5 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#0F3D3E] hover:bg-[#145A5B] text-white text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 tracking-wide"
            >
              {loading ? 'Verificando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-[#a8b3c4] mt-6">
          © {new Date().getFullYear()} PEDV · Todos os direitos reservados
        </p>
      </div>
    </div>
  )
}
