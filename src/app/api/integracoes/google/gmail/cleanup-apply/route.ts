import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { getActiveGoogleConnection, getValidAccessToken } from '@/lib/google/connections'
import { GMAIL_MODIFY_SCOPE } from '@/lib/google/oauth'
import {
  applyGmailCleanupAction,
  fetchGmailMessageMetadata,
  type GmailCleanupAction,
  type GmailPreviewMessage,
  type GmailRiskCategory,
} from '@/lib/google/gmail'

export const runtime = 'nodejs'

const ACTION_LABEL: Record<GmailCleanupAction, string> = {
  trash: 'mover_para_lixeira',
  archive: 'arquivar',
  spam: 'marcar_como_spam',
  mark_read: 'marcar_como_lido',
  label_triaged: 'aplicar_label_triado_pela_aurora',
}

const RISKY_CATEGORIES = new Set<GmailRiskCategory>([
  'juridico_processual',
  'financeiro_banco_pagamento',
  'cliente_contato_humano',
])

type SelectedMessageInput = Pick<GmailPreviewMessage, 'id' | 'categoria' | 'alertaAnexo'>

function parseAction(value: unknown): GmailCleanupAction | null {
  if (
    value === 'trash' ||
    value === 'archive' ||
    value === 'spam' ||
    value === 'mark_read' ||
    value === 'label_triaged'
  ) return value
  return null
}

function parseIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .filter((id): id is string => typeof id === 'string')
    .map(id => id.trim())
    .filter(Boolean))]
    .slice(0, 20)
}

function parseSelectedMessages(value: unknown): SelectedMessageInput[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const candidate = item as Partial<SelectedMessageInput>
    if (typeof candidate.id !== 'string') return []
    return [{
      id: candidate.id,
      categoria: candidate.categoria ?? 'nao_classificado',
      alertaAnexo: candidate.alertaAnexo === true,
    }]
  })
}

function hashGmailId(id: string): string {
  return createHash('sha256').update(id).digest('hex').slice(0, 16)
}

function safeLogError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 160) : 'Erro ao aplicar limpeza Gmail'
}

export async function POST(request: Request) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const action = parseAction(body.action)
  const messageIds = parseIds(body.messageIds)
  const selectedMessages = parseSelectedMessages(body.selectedMessages)
  const confirmRisky = body.confirmRisky === true
  const confirmAttachments = body.confirmAttachments === true

  if (!action) {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  }

  if (messageIds.length === 0) {
    return NextResponse.json({ error: 'Selecione ao menos um e-mail para aplicar a ação.' }, { status: 400 })
  }

  const supabase = await createClient()
  const connection = await getActiveGoogleConnection(supabase, auth.userId)
  if (!connection) {
    return NextResponse.json({ error: 'Gmail não conectado' }, { status: 409 })
  }

  if (!connection.scopes.includes(GMAIL_MODIFY_SCOPE)) {
    return NextResponse.json({
      error: 'Reconecte o Gmail para permitir ações assistidas.',
      requerReconexao: true,
      escopoNecessario: GMAIL_MODIFY_SCOPE,
    }, { status: 409 })
  }

  try {
    const accessToken = await getValidAccessToken(supabase, connection)
    const metadata = await Promise.all(messageIds.map(id => fetchGmailMessageMetadata(accessToken, id)))
    const byId = new Map(selectedMessages.map(message => [message.id, message]))

    const hasAttachmentRisk = metadata.some(message => message.alertaAnexo || byId.get(message.id)?.alertaAnexo)
    const hasCategoryRisk = metadata.some(message => RISKY_CATEGORIES.has(message.categoria) || RISKY_CATEGORIES.has(byId.get(message.id)?.categoria ?? 'nao_classificado'))

    if (hasAttachmentRisk && !confirmAttachments) {
      return NextResponse.json({
        error: 'Há e-mail selecionado com anexo. Confirme a revisão extra antes de aplicar a ação.',
        requerConfirmacaoAnexo: true,
      }, { status: 400 })
    }

    if (hasCategoryRisk && !confirmRisky) {
      return NextResponse.json({
        error: 'Há e-mail sensível selecionado. Confirme a revisão extra antes de aplicar a ação.',
        requerConfirmacaoRisco: true,
      }, { status: 400 })
    }

    const result = await applyGmailCleanupAction(accessToken, action, messageIds)
    const hashes = messageIds.map(hashGmailId).join(',')

    await supabase.from('google_gmail_query_logs').insert({
      user_id: auth.userId,
      connection_id: connection.id,
      query_type: 'cleanup_apply',
      query_redacted: `action=${ACTION_LABEL[action]}; ids_sha256_16=${hashes}`,
      result_count: result.totalAplicado,
      selected_count: result.totalSelecionado,
      imported_count: 0,
      has_attachments: hasAttachmentRisk,
      status: result.falhas.length > 0 ? 'erro' : 'sucesso',
      error_code: result.falhas.length > 0 ? `falhas=${result.falhas.length}` : null,
    })

    return NextResponse.json({
      sucesso: result.falhas.length === 0,
      action,
      actionLabel: ACTION_LABEL[action],
      totalSelecionado: result.totalSelecionado,
      totalAplicado: result.totalAplicado,
      falhas: result.falhas.map(falha => ({
        idHash: hashGmailId(falha.id),
        erro: falha.erro,
      })),
      aviso: 'Ação aplicada somente aos e-mails selecionados. Nenhum e-mail foi excluído definitivamente.',
    })
  } catch (error) {
    const message = safeLogError(error)
    console.error('[gmail/cleanup-apply] falha segura:', { message })
    await supabase.from('google_gmail_query_logs').insert({
      user_id: auth.userId,
      connection_id: connection.id,
      query_type: 'cleanup_apply',
      query_redacted: `action=${ACTION_LABEL[action]}; ids_sha256_16=${messageIds.map(hashGmailId).join(',')}`,
      result_count: 0,
      selected_count: messageIds.length,
      imported_count: 0,
      has_attachments: false,
      status: 'erro',
      error_code: message,
    })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
