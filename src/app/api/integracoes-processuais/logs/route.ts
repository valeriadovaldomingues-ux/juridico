import { NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await apiGuard(['gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), 100)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('integracoes_processuais_sync_logs')
    .select('id, provider, tipo_operacao, status, referencia, mensagem, detalhes, iniciado_em, finalizado_em, criado_por')
    .order('iniciado_em', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ logs: data ?? [] })
}
