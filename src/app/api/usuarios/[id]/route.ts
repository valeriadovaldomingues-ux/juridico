import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiGuard } from '@/lib/auth/api-guard'

// Roles que podem ser atribuídos por cada criador (evita escalada de privilégio)
const ROLES_EDITAVEIS_POR: Record<string, string[]> = {
  socio:   ['estagiario', 'comercial', 'administrativo', 'advogado', 'gerente', 'socio'],
  gerente: ['estagiario', 'comercial', 'administrativo', 'advogado'],
}

/**
 * PUT /api/usuarios/[id]
 * Atualiza nome, role e/ou ativo de um profile.
 * Sócio: qualquer alteração. Gerente: não pode atribuir gerente/sócio.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await apiGuard(['socio', 'gerente'])
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const body = await request.json()

    const campos: Record<string, unknown> = {}
    if (typeof body.nome  === 'string')  campos.nome  = body.nome.trim()
    if (typeof body.role  === 'string')  campos.role  = body.role
    if (typeof body.ativo === 'boolean') campos.ativo = body.ativo

    if (Object.keys(campos).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo válido enviado' }, { status: 400 })
    }

    if (campos.role) {
      const permitidos = ROLES_EDITAVEIS_POR[auth.role] ?? []
      if (!permitidos.includes(campos.role as string)) {
        return NextResponse.json({ error: `Sem permissão para atribuir role '${campos.role}'` }, { status: 403 })
      }
    }

    const service = createServiceClient()
    const { error } = await service.from('profiles').update(campos).eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
