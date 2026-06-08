import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { mapComunicacaoDbRowToDraft } from '@/lib/comunicacao-inteligente'
import type { UserRole } from '@/types'

const ALLOWED_ROLES: UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']

async function registrarLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  comunicacaoId: string,
  acao: 'gerada' | 'editada' | 'aprovada' | 'enviada' | 'descartada',
  realizadoPor: string,
  detalhes: Record<string, unknown>,
) {
  await supabase.from('comunicacoes_inteligentes_logs').insert({
    comunicacao_id: comunicacaoId,
    acao,
    detalhes,
    realizado_por: realizadoPor,
  })
}

function buildPortalMessageContent(titulo: string, texto: string) {
  return [titulo.trim(), texto.trim()].filter(Boolean).join('\n\n')
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ comunicacaoId: string }> },
) {
  const auth = await apiGuard(ALLOWED_ROLES)
  if (auth instanceof NextResponse) return auth

  const { comunicacaoId } = await params
  if (!comunicacaoId) {
    return NextResponse.json({ error: 'ID da comunicação ausente' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: current, error: findError } = await supabase
    .from('comunicacoes_inteligentes')
    .select('id, cliente_id, processo_id, titulo, conteudo_texto, mensagem_cliente, status, canal_destino')
    .eq('id', comunicacaoId)
    .single()

  if (findError || !current) {
    return NextResponse.json({ error: 'Comunicação não encontrada' }, { status: 404 })
  }

  if (current.status !== 'aprovada') {
    return NextResponse.json({ error: 'A comunicação precisa estar aprovada antes do envio' }, { status: 409 })
  }

  if (current.canal_destino !== 'portal') {
    return NextResponse.json({ error: 'Envio automático disponível apenas para o portal do cliente nesta fase' }, { status: 400 })
  }

  const conteudo = buildPortalMessageContent(current.titulo, current.conteudo_texto || current.mensagem_cliente || '')
  if (!conteudo.trim()) {
    return NextResponse.json({ error: 'Conteúdo vazio para envio' }, { status: 400 })
  }

  const { data: portalMensagem, error: portalError } = await supabase
    .from('portal_mensagens')
    .insert({
      cliente_id: current.cliente_id,
      processo_id: current.processo_id,
      autor_tipo: 'escritorio',
      autor_id: auth.userId,
      conteudo,
      tipo: 'outro',
      status: 'aberta',
    })
    .select('id')
    .single()

  if (portalError || !portalMensagem) {
    return NextResponse.json({ error: portalError?.message ?? 'Erro ao registrar mensagem no portal' }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('comunicacoes_inteligentes')
    .update({
      status: 'enviada',
      visivel_portal: true,
      enviado_por: auth.userId,
      enviado_em: new Date().toISOString(),
      portal_mensagem_id: portalMensagem.id,
      atualizado_por: auth.userId,
    })
    .eq('id', comunicacaoId)
    .select(`
      *,
      criado_por_profile:profiles!criado_por(id, nome, email, role),
      aprovado_por_profile:profiles!aprovado_por(id, nome, email, role),
      enviado_por_profile:profiles!enviado_por(id, nome, email, role)
    `)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Erro ao finalizar envio' }, { status: 400 })
  }

  await registrarLog(supabase, comunicacaoId, 'enviada', auth.userId, {
    portal_mensagem_id: portalMensagem.id,
    canal_destino: current.canal_destino,
  })

  return NextResponse.json(
    mapComunicacaoDbRowToDraft(data as Parameters<typeof mapComunicacaoDbRowToDraft>[0]),
  )
}
