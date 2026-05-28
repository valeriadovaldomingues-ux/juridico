import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { isUUID } from '@/lib/portal/validate'
import {
  createAgendaTimeEntryPayload,
  type AgendaTimeEntryDraft,
} from '@/lib/agenda-time-entries'
import type { UserRole, AgendaTimeEntry } from '@/types'

const READ_ALLOWED: UserRole[] = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio']
const WRITE_ALLOWED: UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']

function parseOptionalUUID(value: string | null, field: string) {
  if (value === null || value === '') return null
  if (!isUUID(value)) {
    throw new Error(`${field}: formato UUID inválido`)
  }
  return value
}

function parseIsoDateTime(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} obrigatório`)
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field}: data/hora inválida`)
  }
  return date.toISOString()
}

function parseNullableNumber(value: unknown, field: string) {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  if (Number.isNaN(num)) {
    throw new Error(`${field}: número inválido`)
  }
  return num
}

function normalizeRequestBody(body: any): AgendaTimeEntryDraft {
  const agenda_item_id = typeof body.agenda_item_id === 'string' ? body.agenda_item_id : ''
  if (!agenda_item_id || !isUUID(agenda_item_id)) {
    throw new Error('agenda_item_id: formato UUID inválido')
  }

  const inicio_em = parseIsoDateTime(body.inicio_em, 'inicio_em')
  const fim_em = typeof body.fim_em === 'string' && body.fim_em.trim()
    ? parseIsoDateTime(body.fim_em, 'fim_em')
    : null

  return {
    agenda_item_id,
    cliente_id: parseOptionalUUID(body.cliente_id ?? null, 'cliente_id'),
    processo_id: parseOptionalUUID(body.processo_id ?? null, 'processo_id'),
    descricao_atividade: typeof body.descricao_atividade === 'string' ? body.descricao_atividade : '',
    observacoes: typeof body.observacoes === 'string' ? body.observacoes : null,
    inicio_em,
    fim_em,
    duracao_manual_minutos: parseNullableNumber(body.duracao_manual_minutos, 'duracao_manual_minutos'),
    usa_duracao_manual: Boolean(body.usa_duracao_manual),
    cobravel: body.cobravel === undefined ? true : Boolean(body.cobravel),
    valor_hora: parseNullableNumber(body.valor_hora, 'valor_hora'),
    status_cobranca: body.status_cobranca === 'faturado' || body.status_cobranca === 'nao_faturavel'
      ? body.status_cobranca
      : 'pendente',
  }
}

export async function GET(req: NextRequest) {
  const auth = await apiGuard(READ_ALLOWED)
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  try {
    const agendaItemId = parseOptionalUUID(searchParams.get('agenda_item_id'), 'agenda_item_id')
    const clienteId = parseOptionalUUID(searchParams.get('cliente_id'), 'cliente_id')
    const processoId = parseOptionalUUID(searchParams.get('processo_id'), 'processo_id')
    const inicio = searchParams.get('inicio')
    const fim = searchParams.get('fim')
    const statusCobranca = searchParams.get('status_cobranca')

    let query = supabase
      .from('agenda_time_entries')
      .select(`
        *,
        agenda_item:agenda_items(id, titulo, data_inicio, cliente_id, processo_id),
        cliente:clientes(id, nome),
        processo:processos(id, titulo, numero_processo),
        criado_por_profile:profiles!criado_por(id, nome)
      `)
      .order('inicio_em', { ascending: false })
      .limit(500)

    if (agendaItemId) query = query.eq('agenda_item_id', agendaItemId)
    if (clienteId) query = query.eq('cliente_id', clienteId)
    if (processoId) query = query.eq('processo_id', processoId)
    if (inicio) query = query.gte('inicio_em', parseIsoDateTime(inicio, 'inicio'))
    if (fim) query = query.lte('inicio_em', parseIsoDateTime(fim, 'fim'))
    if (statusCobranca) query = query.eq('status_cobranca', statusCobranca)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Parâmetros inválidos' }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await apiGuard(WRITE_ALLOWED)
  if (auth instanceof NextResponse) return auth

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const supabase = await createClient()

  try {
    const draft = normalizeRequestBody(body)

    const { data: agendaItem, error: agendaErr } = await supabase
      .from('agenda_items')
      .select('id, titulo, cliente_id, processo_id')
      .eq('id', draft.agenda_item_id)
      .single()

    if (agendaErr || !agendaItem) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
    }

    const payload = createAgendaTimeEntryPayload({
      agenda_item_id: draft.agenda_item_id,
      cliente_id: draft.cliente_id ?? agendaItem.cliente_id ?? null,
      processo_id: draft.processo_id ?? agendaItem.processo_id ?? null,
      descricao_atividade: draft.descricao_atividade?.trim() || agendaItem.titulo,
      observacoes: draft.observacoes,
      inicio_em: draft.inicio_em,
      fim_em: draft.fim_em,
      duracao_manual_minutos: draft.duracao_manual_minutos,
      usa_duracao_manual: draft.usa_duracao_manual,
      cobravel: draft.cobravel,
      valor_hora: draft.valor_hora,
      status_cobranca: draft.status_cobranca,
    })

    const { data, error } = await supabase
      .from('agenda_time_entries')
      .insert({
        ...payload,
        cliente_id: payload.cliente_id,
        processo_id: payload.processo_id,
        agenda_item_id: payload.agenda_item_id,
        descricao_atividade: payload.descricao_atividade,
        observacoes: payload.observacoes,
        criado_por: auth.userId,
      })
      .select(`
        *,
        agenda_item:agenda_items(id, titulo, data_inicio, cliente_id, processo_id),
        cliente:clientes(id, nome),
        processo:processos(id, titulo, numero_processo),
        criado_por_profile:profiles!criado_por(id, nome)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data as AgendaTimeEntry, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Dados inválidos' }, { status: 400 })
  }
}

