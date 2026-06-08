import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { isUUID } from '@/lib/portal/validate'
import {
  gerarComunicacaoInteligenteDraft,
  mapComunicacaoDbRowToDraft,
  type ComunicacaoInteligenteDraft,
} from '@/lib/comunicacao-inteligente'
import {
  normalizeComunicaoCanal,
  normalizeComunicaoTipo,
} from '@/lib/comunicacao-inteligente/validation'
import type { Cliente, Processo, ProcessoAndamento, UserRole } from '@/types'

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

async function buscarProcessoCompleto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  processoId: string,
) {
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
      comarca,
      vara,
      classe_processual,
      assunto,
      segredo_justica,
      cliente_id,
      cliente:clientes(id, nome, cpf_cnpj, email, telefone, celular)
    `)
    .eq('id', processoId)
    .single()

  if (error || !processo) {
    return null
  }

  return processo as unknown as Processo & { cliente: Cliente }
}

async function buscarAndamentosParaComunicacao(
  supabase: Awaited<ReturnType<typeof createClient>>,
  processoId: string,
  andamentoIds: string[],
) {
  const query = supabase
    .from('processo_andamentos')
    .select(`
      *,
      responsavel:profiles(id, nome, email, role),
      criado_por_profile:profiles!criado_por(id, nome, email, role)
    `)
    .eq('processo_id', processoId)
    .order('data_andamento', { ascending: false })
    .limit(10)

  if (andamentoIds.length > 0) {
    const { data, error } = await supabase
      .from('processo_andamentos')
      .select(`
        *,
        responsavel:profiles(id, nome, email, role),
        criado_por_profile:profiles!criado_por(id, nome, email, role)
      `)
      .eq('processo_id', processoId)
      .in('id', andamentoIds)
      .order('data_andamento', { ascending: false })

    if (error) {
      throw error
    }

    return (data ?? []) as ProcessoAndamento[]
  }

  const { data, error } = await query
  if (error) {
    throw error
  }

  return (data ?? []) as ProcessoAndamento[]
}

function normalizarAndamentoIds(input: unknown) {
  if (!Array.isArray(input)) return []

  return input
    .map(item => (typeof item === 'string' && isUUID(item) ? item : null))
    .filter(Boolean)
    .slice(0, 20) as string[]
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard(ALLOWED_ROLES)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id || !isUUID(id)) {
    return NextResponse.json({ error: 'ID do processo ausente ou inválido' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('comunicacoes_inteligentes')
    .select(`
      *,
      criado_por_profile:profiles!criado_por(id, nome, email, role),
      aprovado_por_profile:profiles!aprovado_por(id, nome, email, role),
      enviado_por_profile:profiles!enviado_por(id, nome, email, role)
    `)
    .eq('processo_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json((data ?? []).map(mapComunicacaoDbRowToDraft))
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard(ALLOWED_ROLES)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id || !isUUID(id)) {
    return NextResponse.json({ error: 'ID do processo ausente ou inválido' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const supabase = await createClient()
  const processo = await buscarProcessoCompleto(supabase, id)
  if (!processo) {
    return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
  }

  const tipo = normalizeComunicaoTipo((body as { tipo?: string }).tipo ?? null)
  const canalDestino = normalizeComunicaoCanal((body as { canal_destino?: string }).canal_destino ?? null)
  const andamentoIds = normalizarAndamentoIds(
    (body as { andamento_ids?: unknown; andamentoIds?: unknown }).andamento_ids
      ?? (body as { andamentoIds?: unknown }).andamentoIds,
  )

  let andamentosRecorte: ProcessoAndamento[] = []
  try {
    andamentosRecorte = await buscarAndamentosParaComunicacao(supabase, id, andamentoIds)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar andamentos'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const consulta = {
    processoId: id,
    clienteId: processo.cliente_id,
    tipo,
    canalDestino,
    andamentoIds: andamentoIds.length > 0 ? andamentoIds : andamentosRecorte.map(item => item.id),
  }

  const draftPayload = await gerarComunicacaoInteligenteDraft(
    processo,
    processo.cliente as Cliente,
    andamentosRecorte,
    consulta,
  )

  const insertPayload = {
    cliente_id: processo.cliente_id,
    processo_id: id,
    andamento_ids: consulta.andamentoIds,
    tipo: draftPayload.tipo,
    canal_destino: draftPayload.canal_destino,
    status: 'pendente_aprovacao',
    titulo: draftPayload.titulo,
    resumo_executivo: draftPayload.resumoExecutivo,
    o_que_aconteceu: draftPayload.oQueAconteceu,
    o_que_isso_significa: draftPayload.oQueIssoSignifica,
    proximos_passos: draftPayload.proximosPassos,
    acao_necessaria_cliente: draftPayload.acaoNecessariaCliente,
    mensagem_cliente: draftPayload.mensagemCliente,
    observacoes_internas: draftPayload.observacoesInternas,
    campos_nao_encontrados: draftPayload.camposNaoEncontrados,
    inconsistencias: draftPayload.inconsistencias,
    conteudo_json: draftPayload.conteudo_json,
    conteudo_texto: draftPayload.conteudo_texto,
    visivel_portal: false,
    criado_por: auth.userId,
    atualizado_por: auth.userId,
  }

  const { data: created, error: insertError } = await supabase
    .from('comunicacoes_inteligentes')
    .insert(insertPayload)
    .select(`
      *,
      criado_por_profile:profiles!criado_por(id, nome, email, role),
      aprovado_por_profile:profiles!aprovado_por(id, nome, email, role),
      enviado_por_profile:profiles!enviado_por(id, nome, email, role)
    `)
    .single()

  if (insertError || !created) {
    return NextResponse.json({ error: insertError?.message ?? 'Erro ao criar comunicação' }, { status: 400 })
  }

  await registrarLog(supabase, created.id, 'gerada', auth.userId, {
    tipo: draftPayload.tipo,
    canal_destino: draftPayload.canal_destino,
    andamento_ids: consulta.andamentoIds,
  })

  return NextResponse.json(
    mapComunicacaoDbRowToDraft(created as Parameters<typeof mapComunicacaoDbRowToDraft>[0]),
    { status: 201 },
  )
}
