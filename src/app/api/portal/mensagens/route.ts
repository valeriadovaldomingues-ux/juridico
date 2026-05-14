import { NextRequest, NextResponse } from 'next/server'
import { portalGuard }    from '@/lib/auth/portal-guard'
import { createClient }   from '@/lib/supabase/server'
import { logPortalAccess } from '@/lib/portal/access-log'
import { checkOrigin }    from '@/lib/portal/origin'
import { checkContentLength, checkStringLength, isUUID, extractIP, LIMITS } from '@/lib/portal/validate'
import { mensagensByUser, mensagensByIp, checkRateLimit } from '@/lib/portal/rate-limit'

const TIPOS_VALIDOS = ['mensagem', 'solicitacao_documento', 'solicitacao_prazo', 'outro'] as const

/**
 * GET /api/portal/mensagens
 * Lista as mensagens da thread do cliente.
 * Query param: processo_id (UUID, opcional)
 */
export async function GET(request: NextRequest) {
  const session = await portalGuard()
  if (session instanceof NextResponse) return session

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const processoIdRaw = searchParams.get('processo_id')

  // Valida UUID se fornecido — rejeita strings inválidas antes do banco
  if (processoIdRaw !== null && !isUUID(processoIdRaw)) {
    return NextResponse.json({ error: 'processo_id: formato UUID inválido' }, { status: 400 })
  }

  let query = supabase
    .from('portal_mensagens')
    .select('id, autor_tipo, conteudo, tipo, status, lida, processo_id, created_at')
    .eq('cliente_id', session.clienteId)
    .order('created_at', { ascending: true })
    .limit(100)

  if (processoIdRaw) {
    query = query.eq('processo_id', processoIdRaw)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar mensagens' }, { status: 500 })
  }

  // Marca como lidas — apenas mensagens do escritório
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
 * Body: { conteudo: string, tipo?: string, processo_id?: UUID }
 */
export async function POST(request: NextRequest) {
  // ── CSRF ──────────────────────────────────────────────────────────────────
  const originBlocked = checkOrigin(request)
  if (originBlocked) return originBlocked

  // ── Tamanho do payload ────────────────────────────────────────────────────
  const sizeError = checkContentLength(request)
  if (sizeError) return NextResponse.json({ error: sizeError }, { status: 413 })

  // ── Autenticação ──────────────────────────────────────────────────────────
  const session = await portalGuard()
  if (session instanceof NextResponse) return session

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const ip = extractIP(request) ?? 'unknown'
  const [byUser, byIp] = await Promise.all([
    checkRateLimit(mensagensByUser, session.userId),
    checkRateLimit(mensagensByIp,   ip),
  ])

  if (!byUser.allowed || !byIp.allowed) {
    console.warn(`[portal/mensagens] Rate limit — user:${session.userId} ip:${ip}`)
    return NextResponse.json(
      { error: 'Limite de mensagens atingido. Tente novamente mais tarde.' },
      { status: 429 },
    )
  }

  // ── Parse ─────────────────────────────────────────────────────────────────
  let body: { conteudo?: string; tipo?: string; processo_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const conteudo    = body.conteudo?.trim() ?? ''
  const tipo        = body.tipo ?? 'mensagem'
  const processo_id = body.processo_id ?? null

  // ── Validações de campo ───────────────────────────────────────────────────
  if (!conteudo) {
    return NextResponse.json({ error: 'Conteúdo obrigatório' }, { status: 400 })
  }

  const conteudoError = checkStringLength(conteudo, LIMITS.MENSAGEM_CHARS, 'conteudo')
  if (conteudoError) {
    return NextResponse.json({ error: conteudoError }, { status: 400 })
  }

  if (!TIPOS_VALIDOS.includes(tipo as typeof TIPOS_VALIDOS[number])) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }

  if (processo_id !== null && !isUUID(processo_id)) {
    return NextResponse.json({ error: 'processo_id: formato UUID inválido' }, { status: 400 })
  }

  // ── Verifica vínculo processo-cliente (se informado) ─────────────────────
  const supabase = await createClient()

  if (processo_id) {
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

  // ── Persiste ──────────────────────────────────────────────────────────────
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
