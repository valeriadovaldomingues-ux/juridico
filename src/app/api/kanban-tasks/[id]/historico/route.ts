import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio']

/** GET /api/kanban-tasks/:id/historico — histórico de movimentação de um card */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID ausente' }, { status: 400 })

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('kanban_historico')
    .select(`
      *,
      usuario:profiles!usuario_id(id, nome, cor_kanban),
      de_responsavel:profiles!de_responsavel_id(id, nome),
      para_responsavel:profiles!para_responsavel_id(id, nome)
    `)
    .eq('task_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
