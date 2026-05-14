import { NextRequest, NextResponse } from 'next/server'
import { portalGuard }    from '@/lib/auth/portal-guard'
import { createClient }   from '@/lib/supabase/server'
import { logPortalAccess } from '@/lib/portal/access-log'
import { isUUID }         from '@/lib/portal/validate'
import { downloadByUser, checkRateLimit } from '@/lib/portal/rate-limit'

const BUCKET = 'docs-pedv'
const SIGNED_URL_TTL = 900  // 15 minutos

/**
 * GET /api/portal/documentos
 * Lista documentos liberados para o cliente (liberado_cliente = true).
 *
 * Query param:
 *   download=<doc_id> — redirect server-side para signed URL (TTL 15min).
 *   O signed URL nunca é exposto no JSON — a response é um 302 redirect.
 */
export async function GET(request: NextRequest) {
  const session = await portalGuard()
  if (session instanceof NextResponse) return session

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const downloadId = searchParams.get('download')

  // ── Download de documento específico ──────────────────────────────────────
  if (downloadId !== null) {
    // Valida UUID antes de qualquer query
    if (!isUUID(downloadId)) {
      return NextResponse.json({ error: 'ID de documento inválido' }, { status: 400 })
    }

    // Rate limiting por usuário
    const rl = await checkRateLimit(downloadByUser, session.userId)
    if (!rl.allowed) {
      console.warn(`[portal/documentos] Rate limit download — user:${session.userId}`)
      return NextResponse.json(
        { error: 'Limite de downloads atingido. Tente novamente mais tarde.' },
        { status: 429 },
      )
    }

    // Confirma propriedade + liberação (RLS + filtro explícito — dupla proteção)
    const { data: doc } = await supabase
      .from('documentos')
      .select('id, nome_arquivo, storage_path')
      .eq('id', downloadId)
      .eq('cliente_id', session.clienteId)
      .eq('liberado_cliente', true)
      .single()

    if (!doc?.storage_path) {
      return NextResponse.json(
        { error: 'Documento não encontrado ou não liberado' },
        { status: 404 },
      )
    }

    // Gera signed URL server-side
    const { data: signed, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.storage_path, SIGNED_URL_TTL)

    if (error || !signed?.signedUrl) {
      return NextResponse.json({ error: 'Erro ao gerar link de download' }, { status: 500 })
    }

    await logPortalAccess({
      userId:     session.userId,
      clienteId:  session.clienteId,
      acao:       'download_documento',
      resourceId: downloadId,
      detalhes:   { nome_arquivo: doc.nome_arquivo },
      request,
    })

    // Redirect server-side — signed URL nunca exposta no body JSON
    return NextResponse.redirect(signed.signedUrl, { status: 302 })
  }

  // ── Lista de documentos liberados ─────────────────────────────────────────
  const { data: docs, error } = await supabase
    .from('documentos')
    .select('id, nome_arquivo, tipo_documento, created_at')
    .eq('cliente_id', session.clienteId)
    .eq('liberado_cliente', true)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar documentos' }, { status: 500 })
  }

  // doc_gerados liberados — vinculados a processos visíveis do cliente
  const { data: processosIds } = await supabase
    .from('processos')
    .select('id')
    .eq('cliente_id', session.clienteId)
    .eq('visivel_cliente', true)

  const ids = (processosIds ?? []).map(p => p.id)

  const { data: gerados } = ids.length > 0
    ? await supabase
        .from('doc_gerados')
        .select('id, titulo, created_at, processo:processos(numero_processo, titulo)')
        .in('processo_id', ids)
        .eq('liberado_cliente', true)
        .order('created_at', { ascending: false })
    : { data: [] }

  await logPortalAccess({
    userId:    session.userId,
    clienteId: session.clienteId,
    acao:      'view_documento',
    request,
  })

  return NextResponse.json({
    documentos: docs    ?? [],
    gerados:    gerados ?? [],
  })
}
