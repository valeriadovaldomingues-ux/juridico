import { NextResponse } from 'next/server'
import { portalGuard } from '@/lib/auth/portal-guard'
import { createClient } from '@/lib/supabase/server'
import { logPortalAccess } from '@/lib/portal/access-log'

/**
 * GET /api/portal/me
 * Retorna os dados do cliente vinculado ao usuário autenticado.
 */
export async function GET(request: Request) {
  const session = await portalGuard()
  if (session instanceof NextResponse) return session

  const supabase = await createClient()

  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('id, nome, email, telefone, celular, tipo_pessoa, created_at')
    .eq('id', session.clienteId)
    .single()

  if (error || !cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  }

  await logPortalAccess({
    userId:    session.userId,
    clienteId: session.clienteId,
    acao:      'view_perfil',
    request,
  })

  return NextResponse.json(cliente)
}
