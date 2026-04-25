import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'

/**
 * POST /api/usuarios/reset-senha
 * Envia e-mail de redefinição de senha para o usuário informado.
 * Acesso para sócios e gerentes.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await apiGuard(['socio', 'gerente'])
    if (auth instanceof NextResponse) return auth

    const { email, redirectTo } = await request.json() as { email?: string; redirectTo?: string }
    if (!email) return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 })

    const supabase  = await createClient()
    // Resolve a URL base: env var > VERCEL_URL automático > fallback localhost
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo ?? `${baseUrl}/reset-password`,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
