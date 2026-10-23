import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { normalizeSearchText } from '@/lib/cnpj'
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
    // Equipe é pequena: busca tudo que está ativo e filtra aqui, sem acento e em qualquer ordem
    // das palavras ("valeria" acha "Valéria do Val").
    const { data: todos, error } = await supabase
      .from('profiles')
      .select('id, nome, email, role')
      .eq('ativo', true)
      .order('nome')
    if (error) {
      console.error('[profiles busca]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const tokens = normalizeSearchText(q).split(/\s+/).filter(Boolean)
    const data = (todos ?? []).filter(p => {
      const alvo = normalizeSearchText(`${p.nome ?? ''} ${p.email ?? ''} ${p.role ?? ''}`)
      return tokens.every(t => alvo.includes(t))
    }).slice(0, limit)

    return NextResponse.json((data ?? []) as Array<{ id: string; nome: string; email: string | null; role: string | null }>)
  } catch (error) {
    console.error('[profiles busca]', error)
    return NextResponse.json({ error: 'Erro ao buscar profiles' }, { status: 500 })
  }
}
