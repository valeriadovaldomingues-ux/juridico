import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['gerente', 'socio']

export async function GET() {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('kanban_import_logs')
    .select(`
      id,
      import_batch_id,
      arquivo_nome,
      total_linhas,
      importados,
      atualizados,
      ignorados,
      rejeitados,
      erros,
      detalhes,
      created_at,
      usuario:profiles(nome)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
