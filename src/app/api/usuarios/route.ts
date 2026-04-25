import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiGuard } from '@/lib/auth/api-guard'

// Roles que podem criar cada nível (evita escalada de privilégio)
const ROLES_POR_CRIADOR: Record<string, string[]> = {
  socio:   ['estagiario', 'comercial', 'administrativo', 'advogado', 'gerente', 'socio'],
  gerente: ['estagiario', 'comercial', 'administrativo', 'advogado'],
}

/**
 * GET /api/usuarios
 * Lista todos os profiles. Acesso para sócios e gerentes.
 */
export async function GET() {
  const auth = await apiGuard(['socio', 'gerente'])
  if (auth instanceof NextResponse) return auth

  const service = createServiceClient()
  const { data, error } = await service
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/**
 * POST /api/usuarios
 * Cria um novo usuário no Supabase Auth e atualiza seu perfil.
 * Sócio pode criar qualquer role; gerente pode criar até advogado.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await apiGuard(['socio', 'gerente'])
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { nome, email, role, senha } = body as {
      nome?: string; email?: string; role?: string; senha?: string
    }

    if (!nome || !email || !role || !senha) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes: nome, email, role, senha' }, { status: 400 })
    }

    const permitidos = ROLES_POR_CRIADOR[auth.role] ?? []
    if (!permitidos.includes(role)) {
      return NextResponse.json({ error: `Papel inválido ou sem permissão para criar role '${role}'` }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome, role },
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    await serviceClient
      .from('profiles')
      .update({ nome, role })
      .eq('id', newUser.user.id)

    return NextResponse.json({ id: newUser.user.id }, { status: 201 })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
