import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { getActiveGoogleConnection, getValidAccessToken } from '@/lib/google/connections'
import { previewGmailCleanup, type GmailCleanupPreviewInput } from '@/lib/google/gmail'

export const runtime = 'nodejs'

function sanitizeLogQuery(query: string) {
  return query
    .replace(/from:[^\s]+/g, 'from:[redigido]')
    .replace(/subject:\(([^)]{0,40})[^)]*\)/g, 'subject:($1)')
    .slice(0, 300)
}

export async function POST(request: Request) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  let body: GmailCleanupPreviewInput
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const input: GmailCleanupPreviewInput = {
    remetente: typeof body.remetente === 'string' ? body.remetente : undefined,
    assunto: typeof body.assunto === 'string' ? body.assunto : undefined,
    palavraChave: typeof body.palavraChave === 'string' ? body.palavraChave : undefined,
    anteriorA: typeof body.anteriorA === 'string' ? body.anteriorA : undefined,
    posteriorA: typeof body.posteriorA === 'string' ? body.posteriorA : undefined,
    comAnexos: body.comAnexos === true,
    maxResults: Math.min(Math.max(Number(body.maxResults) || 10, 1), 20),
  }

  const supabase = await createClient()
  const connection = await getActiveGoogleConnection(supabase, auth.userId)
  if (!connection) {
    return NextResponse.json({ error: 'Gmail não conectado' }, { status: 409 })
  }

  try {
    const accessToken = await getValidAccessToken(supabase, connection)
    const preview = await previewGmailCleanup(accessToken, input)

    await supabase.from('google_gmail_query_logs').insert({
      user_id: auth.userId,
      connection_id: connection.id,
      query_type: 'cleanup_preview',
      query_redacted: sanitizeLogQuery(preview.query),
      result_count: preview.mensagens.length,
      selected_count: 0,
      imported_count: 0,
      has_attachments: input.comAnexos,
      status: 'sucesso',
    })

    return NextResponse.json({
      ...preview,
      limite: input.maxResults,
      aviso: 'Prévia somente leitura. Nenhum e-mail foi arquivado, excluído, movido, marcado ou enviado.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao consultar Gmail'
    console.error('[gmail/cleanup-preview] falha segura:', { message })
    await supabase.from('google_gmail_query_logs').insert({
      user_id: auth.userId,
      connection_id: connection.id,
      query_type: 'cleanup_preview',
      query_redacted: '[erro antes da consulta]',
      result_count: 0,
      selected_count: 0,
      imported_count: 0,
      has_attachments: input.comAnexos,
      status: 'erro',
      error_code: message.slice(0, 120),
    })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
