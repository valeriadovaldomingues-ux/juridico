import { NextResponse } from 'next/server'
import { portalGuard } from '@/lib/auth/portal-guard'
import { createClient } from '@/lib/supabase/server'
import { logPortalAccess } from '@/lib/portal/access-log'

/**
 * GET /api/portal/processos
 * Lista os processos do cliente com visivel_cliente = true.
 * A RLS garante que apenas processos do próprio cliente são retornados.
 */
export async function GET(request: Request) {
  const session = await portalGuard()
  if (session instanceof NextResponse) return session

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('processos')
    .select(`
      id,
      numero_processo,
      titulo,
      area_direito,
      status,
      fase,
      tribunal,
      vara,
      data_distribuicao,
      created_at
    `)
    .eq('cliente_id', session.clienteId)
    .eq('visivel_cliente', true)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar processos' }, { status: 500 })
  }

  await logPortalAccess({
    userId:    session.userId,
    clienteId: session.clienteId,
    acao:      'view_processo',
    request,
  })

  return NextResponse.json(data ?? [])
}
