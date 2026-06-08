import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { isUUID } from '@/lib/portal/validate'
import {
  buscarRelatorioCompleto,
  registrarLogRelatorio,
} from '@/lib/relatorios-inteligentes/api'
import { canEditRelatorio, canArchiveRelatorio } from '@/lib/relatorios-inteligentes/permissions'
import {
  buildRelatorioTexto,
  normalizeRelatorioConteudo,
  normalizeRelatorioStatus,
} from '@/lib/relatorios-inteligentes/validation'
import type { UserRole } from '@/types'

const EDIT_ROLES: UserRole[] = ['advogado', 'gerente', 'socio']
const ARCHIVE_ROLES: UserRole[] = ['socio']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ relatorioId: string }> },
) {
  const auth = await apiGuard(EDIT_ROLES)
  if (auth instanceof NextResponse) return auth

  if (!canEditRelatorio(auth.role as UserRole)) {
    return NextResponse.json({ error: 'Sem permissão para editar relatórios' }, { status: 403 })
  }

  const { relatorioId } = await params
  if (!relatorioId || !isUUID(relatorioId)) {
    return NextResponse.json({ error: 'ID do relatório ausente ou inválido' }, { status: 400 })
  }

  const supabase = await createClient()
  const current = await buscarRelatorioCompleto(supabase, relatorioId)
  if (!current) {
    return NextResponse.json({ error: 'Relatório não encontrado' }, { status: 404 })
  }

  if (!['rascunho', 'pendente_aprovacao'].includes(current.status)) {
    return NextResponse.json({ error: 'Somente relatórios em rascunho ou pendentes podem ser editados' }, { status: 409 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const conteudoAtual = normalizeRelatorioConteudo(current.conteudo ?? current)
  const conteudoEditado = normalizeRelatorioConteudo({
    ...conteudoAtual,
    resumoExecutivo: body.resumoExecutivo ?? body.resumo_executivo ?? conteudoAtual.resumoExecutivo,
    principaisMovimentacoes: body.principaisMovimentacoes ?? body.principais_movimentacoes ?? conteudoAtual.principaisMovimentacoes,
    situacaoAtual: body.situacaoAtual ?? body.situacao_atual ?? conteudoAtual.situacaoAtual,
    oQueIssoSignifica: body.oQueIssoSignifica ?? body.o_que_isso_significa ?? conteudoAtual.oQueIssoSignifica,
    proximosPassos: body.proximosPassos ?? body.proximos_passos ?? conteudoAtual.proximosPassos,
    providenciasCliente: body.providenciasCliente ?? body.providencias_cliente ?? conteudoAtual.providenciasCliente,
  })

  const titulo = typeof body.titulo === 'string' && body.titulo.trim() ? body.titulo.trim() : current.titulo
  const periodoInicio = typeof body.periodo_inicio === 'string'
    ? body.periodo_inicio
    : typeof body.periodoInicio === 'string'
      ? body.periodoInicio
      : current.periodo_inicio
  const periodoFim = typeof body.periodo_fim === 'string'
    ? body.periodo_fim
    : typeof body.periodoFim === 'string'
      ? body.periodoFim
      : current.periodo_fim

  const status = body.status ? normalizeRelatorioStatus(String(body.status)) : current.status
  if (!['rascunho', 'pendente_aprovacao'].includes(status)) {
    return NextResponse.json({ error: 'Status inválido para edição direta' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('client_reports')
    .update({
      titulo,
      periodo_inicio: periodoInicio || null,
      periodo_fim: periodoFim || null,
      resumo_executivo: conteudoEditado.resumoExecutivo,
      conteudo: conteudoEditado,
      conteudo_texto: buildRelatorioTexto(conteudoEditado, titulo),
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', relatorioId)
    .select(`
      *,
      gerado_por_profile:profiles!gerado_por(id, nome, email, role),
      aprovado_por_profile:profiles!aprovado_por(id, nome, email, role),
      publicado_por_profile:profiles!publicado_por(id, nome, email, role)
    `)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Erro ao atualizar relatório' }, { status: 400 })
  }

  await registrarLogRelatorio(supabase, data.id, 'editado', auth.userId, {
    status,
    titulo,
  })

  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ relatorioId: string }> },
) {
  const auth = await apiGuard(ARCHIVE_ROLES)
  if (auth instanceof NextResponse) return auth

  if (!canArchiveRelatorio(auth.role as UserRole)) {
    return NextResponse.json({ error: 'Sem permissão para arquivar relatórios' }, { status: 403 })
  }

  const { relatorioId } = await params
  if (!relatorioId || !isUUID(relatorioId)) {
    return NextResponse.json({ error: 'ID do relatório ausente ou inválido' }, { status: 400 })
  }

  const supabase = await createClient()
  const current = await buscarRelatorioCompleto(supabase, relatorioId)
  if (!current) {
    return NextResponse.json({ error: 'Relatório não encontrado' }, { status: 404 })
  }

  if (current.status === 'arquivado') {
    return NextResponse.json({ error: 'Relatório já arquivado' }, { status: 409 })
  }

  const { error } = await supabase
    .from('client_reports')
    .update({
      status: 'arquivado',
      updated_at: new Date().toISOString(),
    })
    .eq('id', relatorioId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await registrarLogRelatorio(supabase, relatorioId, 'arquivado', auth.userId, {})

  return new NextResponse(null, { status: 204 })
}
