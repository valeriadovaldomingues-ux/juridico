import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import {
  andamentoTipoPermitidoParaRole,
  normalizeAndamentoOrigem,
  normalizeAndamentoTipo,
} from '@/lib/processos/andamentos'
import { normalizarTempo, dataHoraBrasilia, type TempoEntrada } from '@/lib/processos/andamento-tempo'
import { createAgendaTimeEntryPayload } from '@/lib/agenda-time-entries'

const ALLOWED_ROLES = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'] as const

function parseDataAndamento(value?: string | null) {
  if (!value) return new Date()
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard([...ALLOWED_ROLES])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'ID do processo ausente' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('processo_andamentos')
    .select(`
      *,
      responsavel:profiles!responsavel_id(id, nome, email, role),
      criado_por_profile:profiles!criado_por(id, nome, email, role)
    `)
    .eq('processo_id', id)
    .order('data_andamento', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard([...ALLOWED_ROLES])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'ID do processo ausente' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const titulo = String((body as { titulo?: string }).titulo ?? '').trim()
  if (!titulo) {
    return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })
  }

  const tipo = normalizeAndamentoTipo((body as { tipo?: string }).tipo ?? null)
  if (!andamentoTipoPermitidoParaRole(auth.role, tipo)) {
    return NextResponse.json({ error: 'Sem permissão para este tipo de andamento' }, { status: 403 })
  }

  const dataAndamento = parseDataAndamento((body as { data_andamento?: string }).data_andamento ?? null)
  if (!dataAndamento) {
    return NextResponse.json({ error: 'Data do andamento inválida' }, { status: 400 })
  }

  // Tempo gasto (opcional): validado ANTES de gravar, para não salvar andamento com tempo inválido.
  const tempoResultado = normalizarTempo((body as { tempo?: TempoEntrada }).tempo, dataAndamento.toISOString())
  if (tempoResultado && !tempoResultado.ok) {
    return NextResponse.json({ error: tempoResultado.erro }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('processo_andamentos')
    .insert({
      processo_id: id,
      data_andamento: dataAndamento.toISOString(),
      tipo,
      titulo,
      descricao: String((body as { descricao?: string }).descricao ?? '').trim() || null,
      origem: normalizeAndamentoOrigem((body as { origem?: string }).origem ?? null),
      responsavel_id: String((body as { responsavel_id?: string }).responsavel_id ?? '').trim() || null,
      criado_por: auth.userId,
    })
    .select(`
      *,
      responsavel:profiles!responsavel_id(id, nome, email, role),
      criado_por_profile:profiles!criado_por(id, nome, email, role)
    `)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Erro ao criar andamento' }, { status: 400 })
  }

  // Com tempo informado: cria o item concluído na Agenda (ligado ao processo/cliente/andamento)
  // e o lançamento de horas — entra no relatório de horas por cliente. Falha aqui não desfaz o
  // andamento (já salvo): devolve o aviso para a tela mostrar.
  let tempoAviso: string | null = null
  if (tempoResultado?.ok) {
    try {
      const t = tempoResultado.tempo
      const { data: processo } = await supabase
        .from('processos').select('cliente_id, titulo, numero_processo').eq('id', id).maybeSingle()
      const { data: equipe } = await supabase.rpc('perfis_equipe')
      const quemFez = (equipe as { id: string; nome: string }[] | null)
        ?.find(p => p.id === (data.responsavel_id ?? auth.userId))?.nome ?? null
      const inicio = dataHoraBrasilia(t.inicio_em)
      const fim = t.fim_em ? dataHoraBrasilia(t.fim_em) : null

      const { data: item, error: itemErr } = await supabase
        .from('agenda_items')
        .insert({
          titulo: data.titulo,
          descricao: data.descricao,
          tipo: 'tarefa',
          status: 'concluido',
          data_inicio: inicio.data,
          hora_inicio: inicio.hora,
          data_fim: fim ? fim.data : null,
          hora_fim: fim ? fim.hora : null,
          processo_id: id,
          cliente_id: processo?.cliente_id ?? null,
          responsavel: quemFez,
          andamento_id: data.id,
          source: 'manual',
        })
        .select('id')
        .single()
      if (itemErr || !item) throw new Error(itemErr?.message ?? 'não foi possível criar o item na agenda')

      const payload = createAgendaTimeEntryPayload({
        agenda_item_id: item.id,
        cliente_id: processo?.cliente_id ?? null,
        processo_id: id,
        descricao_atividade: data.titulo,
        inicio_em: t.inicio_em,
        fim_em: t.fim_em,
        duracao_manual_minutos: t.duracao_manual_minutos,
        usa_duracao_manual: t.usa_duracao_manual,
        cobravel: t.cobravel,
      })
      const { error: entryErr } = await supabase
        .from('agenda_time_entries')
        .insert({ ...payload, criado_por: auth.userId })
      if (entryErr) {
        await supabase.from('agenda_items').delete().eq('id', item.id)
        throw new Error(entryErr.message)
      }
    } catch (err) {
      tempoAviso = `Andamento salvo, mas o tempo não foi lançado: ${err instanceof Error ? err.message : 'erro desconhecido'}`
    }
  }

  return NextResponse.json({ ...data, tempo_aviso: tempoAviso, tempo_lancado: !!tempoResultado?.ok && !tempoAviso }, { status: 201 })
}
