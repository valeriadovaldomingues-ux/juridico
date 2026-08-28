import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiGuard } from '@/lib/auth/api-guard'

/**
 * POST /api/usuarios/[id]/definir-senha
 *
 * Define uma senha nova diretamente para o usuário, sem depender de e-mail.
 * Alternativa ao fluxo de redefinição por e-mail (/api/usuarios/reset-senha),
 * útil quando o envio de e-mail está indisponível (ex.: rate limit do
 * provedor de e-mail do Supabase). Acesso para sócios e gerentes.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await apiGuard(['socio', 'gerente'])
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const body = await request.json()
    const { senha } = body as { senha?: string }

    if (!senha) return NextResponse.json({ error: 'Senha obrigatória' }, { status: 400 })
    if (senha.length < 6) return NextResponse.json({ error: 'Senha mínima: 6 caracteres' }, { status: 400 })

    const service = createServiceClient()
    const { error } = await service.auth.admin.updateUserById(id, { password: senha })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
