import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { escapeLike, normalizeSearchText } from '@/lib/cnpj'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['estagiario', 'comercial', 'administrativo', 'advogado', 'gerente', 'socio']

function clampLimit(value: string | null, fallback = 10) {
  const parsed = Number.parseInt(value ?? '', 10)
  if (Number.isNaN(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, 20)
}

export async function GET(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = clampLimit(req.nextUrl.searchParams.get('limit'), 10)

  if (q.length < 2) {
    return NextResponse.json([])
  }

  try {
    const supabase = await createClient()
    const safe = escapeLike(q)
    const normalized = normalizeSearchText(q)

    let query = supabase
      .from('profiles')
      .select('id, nome, email, role')
      .eq('ativo', true)
      .limit(limit)
      .order('nome')

    query = query.or([
      `nome.ilike.%${safe}%`,
      `email.ilike.%${safe}%`,
      normalized ? `role.ilike.%${safe}%` : null,
    ].filter(Boolean).join(','))

    const { data, error } = await query
    if (error) {
      console.error('[profiles busca]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json((data ?? []) as Array<{ id: string; nome: string; email: string | null; role: string | null }>)
  } catch (error) {
    console.error('[profiles busca]', error)
    return NextResponse.json({ error: 'Erro ao buscar profiles' }, { status: 500 })
  }
}
