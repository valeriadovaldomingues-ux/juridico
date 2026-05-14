import { NextRequest, NextResponse } from 'next/server'
import { portalGuard } from '@/lib/auth/portal-guard'
import { createClient } from '@/lib/supabase/server'
import { logPortalAccess } from '@/lib/portal/access-log'

/**
 * GET /api/portal/documentos
 * Lista documentos liberados para o cliente (liberado_cliente = true).
 *
 * Query param:
 *   download=<doc_id> — gera URL assinada (TTL 15min) para o documento solicitado
 */
export async function GET(request: NextRequest) {
  const session = await portalGuard()
  if (session instanceof NextResponse) return session

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const downloadId = searchParams.get('download')

  // ── Download de documento específico ──────────────────────────────────────
  if (downloadId) {
    // Confirma que o doc pertence ao cliente e está liberado (RLS + filtro explícito)
    const { data: doc } = await supabase
      .from('documentos')
      .select('id, nome_arquivo, storage_path')
      .eq('id', downloadId)
      .eq('cliente_id', session.clienteId)
      .eq('liberado_cliente', true)
      .single()

    if (!doc?.storage_path) {
      return NextResponse.json({ error: 'Documento não encontrado ou não liberado' }, { status: 404 })
    }

    const { data: signed, error } = await supabase.storage
      .from('documentos')
      .createSignedUrl(doc.storage_path, 900) // 15 minutos

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

    return NextResponse.json({
      url:        signed.signedUrl,
      expires_in: 900,
      nome:       doc.nome_arquivo,
    })
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

  // doc_gerados liberados — documentos gerados pela IA vinculados a processos do cliente
  const { data: gerados } = await supabase
    .from('doc_gerados')
    .select(`
      id,
      titulo,
      created_at,
      processo:processos(numero_processo, titulo)
    `)
    .eq('liberado_cliente', true)
    .in(
      'processo_id',
      // Subquery via JS: busca os processo_ids visíveis do cliente
      await supabase
        .from('processos')
        .select('id')
        .eq('cliente_id', session.clienteId)
        .eq('visivel_cliente', true)
        .then(r => (r.data ?? []).map(p => p.id)),
    )
    .order('created_at', { ascending: false })

  await logPortalAccess({
    userId:    session.userId,
    clienteId: session.clienteId,
    acao:      'view_documento',
    request,
  })

  return NextResponse.json({
    documentos: docs   ?? [],
    gerados:    gerados ?? [],
  })
}
