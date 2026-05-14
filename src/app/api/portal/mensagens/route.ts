import { NextRequest, NextResponse } from 'next/server'
import { portalGuard } from '@/lib/auth/portal-guard'
import { createClient } from '@/lib/supabase/server'
import { logPortalAccess } from '@/lib/portal/access-log'

/**
 * GET /api/portal/mensagens
 * Lista as mensagens da thread do cliente.
 *
 * Query params:
 *   processo_id — filtra por processo (opcional)
 */
export async function GET(request: NextRequest) {
  const session = await portalGuard()
  if (session instanceof NextResponse) return session

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const processoId = searchParams.get('processo_id')

  let query = supabase
    .from('portal_mensagens')
    .select('id, autor_tipo, conteudo, tipo, status, lida, processo_id, created_at')
    .eq('cliente_id', session.clienteId)
    .order('created_at', { ascending: true })
    .limit(100)

  if (processoId) {
    query = query.eq('processo_id', processoId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar mensagens' }, { status: 500 })
  }

  // Marca as mensagens do escritório como lidas
  const naoLidasIds = (data ?? [])
    .filter(m => m.autor_tipo === 'escritorio' && !m.lida)
    .map(m => m.id)

  if (naoLidasIds.length > 0) {
    await supabase
      .from('portal_mensagens')
      .update({ lida: true })
      .in('id', naoLidasIds)
  }

  await logPortalAccess({
    userId:    session.userId,
    clienteId: session.clienteId,
    acao:      'view_mensagens',
    request,
  })

  return NextResponse.json(data ?? [])
}

/**
 * POST /api/portal/mensagens
 * Envia uma mensagem do cliente para o escritório.
 *
 * Body: { conteudo, tipo?, processo_id? }
 */
export async function POST(request: NextRequest) {
  const session = await portalGuard()
  if (session instanceof NextResponse) return session

  let body: { conteudo?: string; tipo?: string; processo_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const conteudo    = body.conteudo?.trim() ?? ''
  const tipo        = body.tipo ?? 'mensagem'
  const processo_id = body.processo_id ?? null

  const TIPOS_VALIDOS = ['mensagem', 'solicitacao_documento', 'solicitacao_prazo', 'outro']

  if (!conteudo) {
    return NextResponse.json({ error: 'Conteúdo obrigatório' }, { status: 400 })
  }
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }

  // Valida processo_id se fornecido (deve ser visível para o cliente)
  if (processo_id) {
    const supabase = await createClient()
    const { data: proc } = await supabase
      .from('processos')
      .select('id')
      .eq('id', processo_id)
      .eq('cliente_id', session.clienteId)
      .eq('visivel_cliente', true)
      .single()

    if (!proc) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('portal_mensagens')
    .insert({
      cliente_id:  session.clienteId,
      processo_id: processo_id ?? null,
      autor_tipo:  'cliente',
      autor_id:    session.userId,
      conteudo,
      tipo,
    })
    .select('id, autor_tipo, conteudo, tipo, status, lida, processo_id, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Erro ao enviar mensagem' }, { status: 500 })
  }

  await logPortalAccess({
    userId:     session.userId,
    clienteId:  session.clienteId,
    acao:       'send_message',
    resourceId: processo_id ?? undefined,
    request,
  })

  return NextResponse.json(data, { status: 201 })
}
