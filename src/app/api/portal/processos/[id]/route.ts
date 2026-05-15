import { NextResponse } from 'next/server'
import { portalGuard }    from '@/lib/auth/portal-guard'
import { createClient }   from '@/lib/supabase/server'
import { logPortalAccess } from '@/lib/portal/access-log'
import { isUUID }          from '@/lib/portal/validate'

/**
 * GET /api/portal/processos/[id]
 * Retorna detalhe de um processo com partes e publicações.
 * A RLS garante que o cliente só acessa seus próprios processos visíveis.
 *
 * Campos EXCLUÍDOS intencionalmente (nunca expor ao cliente):
 *   observacoes          — campo interno estratégico: notas do advogado, estratégia,
 *                          alertas internos. Nunca expor ao cliente.
 *   valor_causa          — campo financeiro: oculto até definição formal de política
 *                          de exposição (ver: docs/portal-data-policy.md quando criado).
 *   advogado_responsavel_id — UUID interno do advogado, sem valor para o cliente.
 *   cliente_id           — redundante: já implícito pelo contexto de sessão.
 *   visivel_cliente      — flag de controle interno, sem valor informativo para o cliente.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await portalGuard()
  if (session instanceof NextResponse) return session

  const { id } = await params

  // Valida formato UUID antes de qualquer query ao banco
  if (!isUUID(id)) {
    return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
  }

  const supabase = await createClient()

  // Campos expostos ao cliente — mínimo necessário para a interface funcionar.
  // Para adicionar um campo, verificar primeiro se é dado interno ou estratégico.
  const { data: processo, error } = await supabase
    .from('processos')
    .select(`
      id,
      numero_processo,
      titulo,
      area_direito,
      status,
      fase,
      tribunal,
      vara,
      data_distribuicao
    `)
    .eq('id', id)
    .eq('cliente_id', session.clienteId)
    .eq('visivel_cliente', true)
    .single()

  if (error || !processo) {
    return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
  }

  // Partes do processo.
  // Campos EXCLUÍDOS: documento (CPF/CNPJ da parte — dado pessoal de terceiro,
  // LGPD), observacoes (notas internas sobre a parte).
  const { data: partes } = await supabase
    .from('partes_processo')
    .select('id, pessoa_nome, tipo_parte')
    .eq('processo_id', id)
    .order('tipo_parte')

  // Publicações vinculadas ao processo.
  // Campos EXCLUÍDOS: texto_publicacao (texto completo do DJe — pode conter dados
  // de todas as partes antes de revisão do advogado), hash (dedup interno),
  // status (workflow interno: nao_tratada/tratada/descartada), advogado_monitorado_id,
  // oab_pesquisada, termo_encontrado, origem (metadata de monitoramento interno).
  const { data: publicacoes } = await supabase
    .from('publicacoes')
    .select(`
      id,
      tipo_publicacao,
      data_publicacao,
      resumo,
      prazo_detectado,
      prazo_data,
      audiencia_detectada,
      audiencia_data,
      created_at
    `)
    .eq('processo_id', id)
    .order('data_publicacao', { ascending: false })
    .limit(20)

  await logPortalAccess({
    userId:     session.userId,
    clienteId:  session.clienteId,
    acao:       'view_processo',
    resourceId: id,
    request,
  })

  return NextResponse.json({
    ...processo,
    partes:      partes      ?? [],
    publicacoes: publicacoes ?? [],
  })
}
