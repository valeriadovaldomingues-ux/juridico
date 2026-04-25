import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiGuard } from '@/lib/auth/api-guard'

// Quais roles cada perfil pode criar (sem escalada de privilégio)
const ROLES_PERMITIDOS: Record<string, string[]> = {
  socio:   ['estagiario', 'comercial', 'administrativo', 'advogado', 'gerente', 'socio'],
  gerente: ['estagiario', 'comercial', 'administrativo', 'advogado'],
}

/**
 * POST /api/usuarios/create
 *
 * Cria um novo usuário no Supabase Auth e inicializa seu perfil.
 * Sócio pode criar qualquer role.
 * Gerente pode criar até advogado (sem gerente/sócio — sem escalada de privilégio).
 *
 * Body: { nome, email, role, senha }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await apiGuard(['socio', 'gerente'])
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { nome, email, role, senha } = body as {
      nome?: string
      email?: string
      role?: string
      senha?: string
    }

    // Validação de campos obrigatórios
    if (!nome?.trim())  return NextResponse.json({ error: 'Nome obrigatório' },  { status: 400 })
    if (!email?.trim()) return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 })
    if (!role)          return NextResponse.json({ error: 'Role obrigatório' },   { status: 400 })
    if (!senha)         return NextResponse.json({ error: 'Senha obrigatória' },  { status: 400 })
    if (senha.length < 6) return NextResponse.json({ error: 'Senha mínima: 6 caracteres' }, { status: 400 })

    // Validação de privilégio
    const permitidos = ROLES_PERMITIDOS[auth.role] ?? []
    if (!permitidos.includes(role)) {
      return NextResponse.json(
        { error: `Perfil '${role}' não pode ser criado por um ${auth.role}` },
        { status: 403 },
      )
    }

    const service = createServiceClient()

    // ── 1. Criar usuário no Supabase Auth ─────────────────────────────────────
    // user_metadata é lido pelo trigger handle_new_user para popular o profile.
    // Mesmo que o trigger não leia role (versão antiga do schema.sql), o upsert
    // abaixo garante que o profile terá os dados corretos.
    const { data: newUser, error: createError } = await service.auth.admin.createUser({
      email:         email.trim(),
      password:      senha,
      email_confirm: true,
      user_metadata: { nome: nome.trim(), role },
    })

    if (createError) {
      if (createError.message.toLowerCase().includes('already')) {
        return NextResponse.json({ error: 'E-mail já cadastrado no sistema' }, { status: 409 })
      }
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    const userId = newUser.user.id

    // ── 2. Upsert do profile ───────────────────────────────────────────────────
    // Usa upsert (não update) para cobrir dois casos:
    //   a) trigger criou o profile sem role → atualiza com role correto
    //   b) trigger falhou / versão antiga sem role → insere o profile completo
    // Se falhar, reverte o Auth user para não deixar estado inconsistente.
    const { error: profileError } = await service
      .from('profiles')
      .upsert(
        { id: userId, nome: nome.trim(), email: email.trim(), role, ativo: true },
        { onConflict: 'id' },
      )

    if (profileError) {
      // Rollback: remover o Auth user para evitar usuário órfão
      try {
        await service.auth.admin.deleteUser(userId)
      } catch (rollbackErr) {
        // Rollback falhou — registra para investigação manual
        console.error('[usuarios/create] ATENÇÃO: Auth user criado mas sem profile.', {
          userId,
          nome: nome.trim(),
          email: email.trim(),
          role,
          profileError: profileError.message,
          rollbackErr,
        })
      }
      return NextResponse.json(
        { error: 'Falha ao criar perfil do usuário. Operação revertida.' },
        { status: 500 },
      )
    }

    return NextResponse.json(
      { id: userId, nome: nome.trim(), email: email.trim(), role },
      { status: 201 },
    )

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
