import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { mapComunicacaoDbRowToDraft, rebuildComunicacaoTexto } from '@/lib/comunicacao-inteligente'
import { normalizeComunicacaoConteudo, normalizeComunicaoCanal, normalizeComunicaoStatus, normalizeComunicaoTipo, normalizeString } from '@/lib/comunicacao-inteligente/validation'
import type { UserRole } from '@/types'

const ALLOWED_ROLES: UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']

async function registrarLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  comunicacaoId: string,
  acao: 'gerada' | 'editada' | 'aprovada' | 'enviada' | 'enviada_manual_whatsapp' | 'whatsapp_iniciado' | 'whatsapp_confirmado' | 'descartada',
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

export async function PATCH(
  request: NextRequest,
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
    .select('*')
    .eq('id', comunicacaoId)
    .single()

  if (findError || !current) {
    return NextResponse.json({ error: 'Comunicação não encontrada' }, { status: 404 })
  }

  if (current.status === 'enviada' || current.status === 'enviada_manual_whatsapp' || current.status === 'descartada') {
    return NextResponse.json({ error: 'Comunicação já finalizada não pode ser editada' }, { status: 409 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const conteudoAtual = normalizeComunicacaoConteudo(current.conteudo_json ?? current)
  const conteudoEditado = normalizeComunicacaoConteudo({
    ...conteudoAtual,
    resumoExecutivo: body.resumoExecutivo ?? body.resumo_executivo ?? conteudoAtual.resumoExecutivo,
    oQueAconteceu: body.oQueAconteceu ?? body.o_que_aconteceu ?? conteudoAtual.oQueAconteceu,
    oQueIssoSignifica: body.oQueIssoSignifica ?? body.o_que_isso_significa ?? conteudoAtual.oQueIssoSignifica,
    proximosPassos: body.proximosPassos ?? body.proximos_passos ?? conteudoAtual.proximosPassos,
    acaoNecessariaCliente: body.acaoNecessariaCliente ?? body.acao_necessaria_cliente ?? conteudoAtual.acaoNecessariaCliente,
    mensagemCliente: body.mensagemCliente ?? body.mensagem_cliente ?? conteudoAtual.mensagemCliente,
    observacoesInternas: body.observacoesInternas ?? body.observacoes_internas ?? conteudoAtual.observacoesInternas,
    camposNaoEncontrados: body.camposNaoEncontrados ?? body.campos_nao_encontrados ?? conteudoAtual.camposNaoEncontrados,
    inconsistencias: body.inconsistencias ?? conteudoAtual.inconsistencias,
  })

  const tipo = normalizeComunicaoTipo((body as { tipo?: string }).tipo ?? current.tipo)
  const canalDestino = normalizeComunicaoCanal((body as { canal_destino?: string }).canal_destino ?? current.canal_destino)
  const status = normalizeComunicaoStatus((body as { status?: string }).status ?? 'em_edicao')
  const titulo = normalizeString((body as { titulo?: unknown }).titulo) || current.titulo

  const conteudoTexto = rebuildComunicacaoTexto(conteudoEditado, titulo)

  const { data, error } = await supabase
    .from('comunicacoes_inteligentes')
    .update({
      tipo,
      canal_destino: canalDestino,
      status,
      titulo,
      resumo_executivo: conteudoEditado.resumoExecutivo,
      o_que_aconteceu: conteudoEditado.oQueAconteceu,
      o_que_isso_significa: conteudoEditado.oQueIssoSignifica,
      proximos_passos: conteudoEditado.proximosPassos,
      acao_necessaria_cliente: conteudoEditado.acaoNecessariaCliente,
      mensagem_cliente: conteudoEditado.mensagemCliente,
      observacoes_internas: conteudoEditado.observacoesInternas,
      campos_nao_encontrados: conteudoEditado.camposNaoEncontrados,
      inconsistencias: conteudoEditado.inconsistencias,
      conteudo_json: conteudoEditado,
      conteudo_texto: conteudoTexto,
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
    return NextResponse.json({ error: error?.message ?? 'Erro ao atualizar comunicação' }, { status: 400 })
  }

  await registrarLog(supabase, data.id, 'editada', auth.userId, {
    status,
    tipo,
    canal_destino: canalDestino,
  })

  return NextResponse.json(
    mapComunicacaoDbRowToDraft(data as Parameters<typeof mapComunicacaoDbRowToDraft>[0]),
  )
}

export async function DELETE(
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
    .select('id, status')
    .eq('id', comunicacaoId)
    .single()

  if (findError || !current) {
    return NextResponse.json({ error: 'Comunicação não encontrada' }, { status: 404 })
  }

  if (current.status === 'enviada' || current.status === 'enviada_manual_whatsapp') {
    return NextResponse.json({ error: 'Comunicação já enviada não pode ser descartada' }, { status: 409 })
  }

  const { error } = await supabase
    .from('comunicacoes_inteligentes')
    .update({
      status: 'descartada',
      visivel_portal: false,
      atualizado_por: auth.userId,
    })
    .eq('id', comunicacaoId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await registrarLog(supabase, comunicacaoId, 'descartada', auth.userId, {})

  return new NextResponse(null, { status: 204 })
}
