import { NextResponse } from 'next/server'
import { portalGuard } from '@/lib/auth/portal-guard'
import { createClient } from '@/lib/supabase/server'
import { logPortalAccess } from '@/lib/portal/access-log'

/**
 * GET /api/portal/agenda
 * Lista audiências (agenda_items) e prazos visíveis para o cliente.
 * Filtra apenas itens vinculados a processos visíveis do cliente.
 */
export async function GET(request: Request) {
  const session = await portalGuard()
  if (session instanceof NextResponse) return session

  const supabase = await createClient()

  // Agenda items — RLS filtra por processo visível do cliente
  const { data: agendaItems } = await supabase
    .from('agenda_items')
    .select(`
      id,
      titulo,
      tipo,
      status,
      data_inicio,
      hora_inicio,
      data_fim,
      prioridade,
      processo_id,
      processo:processos(numero_processo, titulo)
    `)
    .eq('visivel_cliente', true)
    .gte('data_inicio', new Date().toISOString().split('T')[0])
    .order('data_inicio', { ascending: true })
    .limit(50)

  // Prazos processuais — RLS filtra por processo visível do cliente
  const { data: prazos } = await supabase
    .from('prazos')
    .select(`
      id,
      titulo,
      tipo,
      status,
      data_final,
      prioridade,
      processo_id,
      processo:processos(numero_processo, titulo)
    `)
    .eq('visivel_cliente', true)
    .eq('status', 'pendente')
    .gte('data_final', new Date().toISOString().split('T')[0])
    .order('data_final', { ascending: true })
    .limit(50)

  await logPortalAccess({
    userId:    session.userId,
    clienteId: session.clienteId,
    acao:      'view_agenda',
    request,
  })

  return NextResponse.json({
    agenda: agendaItems ?? [],
    prazos: prazos      ?? [],
  })
}
