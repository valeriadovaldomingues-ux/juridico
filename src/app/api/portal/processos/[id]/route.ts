import { NextResponse } from 'next/server'
import { portalGuard } from '@/lib/auth/portal-guard'
import { createClient } from '@/lib/supabase/server'
import { logPortalAccess } from '@/lib/portal/access-log'

/**
 * GET /api/portal/processos/[id]
 * Retorna detalhe de um processo com partes e publicações.
 * A RLS garante que o cliente só acessa seus próprios processos visíveis.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await portalGuard()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const supabase = await createClient()

  // Processo principal — RLS já filtra por cliente + visivel_cliente
  const { data: processo, error } = await supabase
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
      valor_causa,
      data_distribuicao,
      observacoes,
      created_at
    `)
    .eq('id', id)
    .eq('cliente_id', session.clienteId)
    .eq('visivel_cliente', true)
    .single()

  if (error || !processo) {
    return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
  }

  // Partes do processo — RLS aplica a mesma restrição de escopo
  const { data: partes } = await supabase
    .from('partes_processo')
    .select('id, pessoa_nome, tipo_parte')
    .eq('processo_id', id)
    .order('tipo_parte')

  // Publicações vinculadas — apenas as do processo visible
  const { data: publicacoes } = await supabase
    .from('publicacoes')
    .select('id, tipo_publicacao, data_publicacao, resumo, prazo_detectado, prazo_data, audiencia_detectada, audiencia_data, created_at')
    .eq('processo_id', id)
    .order('data_publicacao', { ascending: false })
    .limit(20)

  await logPortalAccess({
    userId:     session.userId,
    clienteId:  session.clienteId,
    acao:       'view_processo',
    resourceId: id,
    request,
  })

  return NextResponse.json({
    ...processo,
    partes:      partes      ?? [],
    publicacoes: publicacoes ?? [],
  })
}
