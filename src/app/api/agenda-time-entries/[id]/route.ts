import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { isUUID } from '@/lib/portal/validate'
import {
  createAgendaTimeEntryPayload,
  type AgendaTimeEntryDraft,
} from '@/lib/agenda-time-entries'
import type { UserRole, AgendaTimeEntry } from '@/types'

const WRITE_ALLOWED: UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']

function parseOptionalUUID(value: unknown, field: string) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string' || !isUUID(value)) {
    throw new Error(`${field}: formato UUID inválido`)
  }
  return value
}

function parseOptionalIsoDateTime(value: unknown, field: string) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string') {
    throw new Error(`${field}: data/hora inválida`)
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field}: data/hora inválida`)
  }
  return date.toISOString()
}

function parseOptionalNumber(value: unknown, field: string) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const num = Number(value)
  if (Number.isNaN(num)) {
    throw new Error(`${field}: número inválido`)
  }
  return num
}

async function getCurrentEntry(id: string) {
  const supabase = await createClient()
  return supabase
    .from('agenda_time_entries')
    .select('*, criado_por')
    .eq('id', id)
    .single()
}

function buildDraftFromPatch(current: AgendaTimeEntry, body: any): AgendaTimeEntryDraft {
  const inicioEm = parseOptionalIsoDateTime(body.inicio_em, 'inicio_em') ?? current.inicio_em
  const fimEm = parseOptionalIsoDateTime(body.fim_em, 'fim_em')
  const duracaoManual = parseOptionalNumber(body.duracao_manual_minutos, 'duracao_manual_minutos')
  const valorHora = parseOptionalNumber(body.valor_hora, 'valor_hora')

  return {
    agenda_item_id: current.agenda_item_id,
    cliente_id: parseOptionalUUID(body.cliente_id, 'cliente_id') ?? current.cliente_id,
    processo_id: parseOptionalUUID(body.processo_id, 'processo_id') ?? current.processo_id,
    descricao_atividade: typeof body.descricao_atividade === 'string'
      ? body.descricao_atividade
      : current.descricao_atividade,
    observacoes: body.observacoes === undefined
      ? current.observacoes
      : (typeof body.observacoes === 'string' ? body.observacoes : null),
    inicio_em: inicioEm,
    fim_em: fimEm === undefined ? current.fim_em : fimEm,
    duracao_manual_minutos: duracaoManual === undefined ? current.duracao_manual_minutos : duracaoManual,
    usa_duracao_manual: body.usa_duracao_manual === undefined ? current.usa_duracao_manual : Boolean(body.usa_duracao_manual),
    cobravel: body.cobravel === undefined ? current.cobravel : Boolean(body.cobravel),
    valor_hora: valorHora === undefined ? current.valor_hora : valorHora,
    status_cobranca: body.status_cobranca === 'faturado' || body.status_cobranca === 'nao_faturavel'
      ? body.status_cobranca
      : current.status_cobranca,
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(WRITE_ALLOWED)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id || !isUUID(id)) {
    return NextResponse.json({ error: 'ID ausente ou inválido' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: current, error: currentError } = await supabase
    .from('agenda_time_entries')
    .select('*')
    .eq('id', id)
    .single()

  if (currentError || !current) {
    return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })
  }

  if (auth.role === 'advogado' && current.criado_por !== auth.userId) {
    return NextResponse.json({ error: 'Sem permissão para alterar este lançamento' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  try {
    const draft = buildDraftFromPatch(current as AgendaTimeEntry, body)
    const payload = createAgendaTimeEntryPayload(draft)

    const { data, error } = await supabase
      .from('agenda_time_entries')
      .update({
        agenda_item_id: draft.agenda_item_id,
        cliente_id: draft.cliente_id,
        processo_id: draft.processo_id,
        inicio_em: payload.inicio_em,
        fim_em: payload.fim_em,
        duracao_manual_minutos: payload.duracao_manual_minutos,
        usa_duracao_manual: payload.usa_duracao_manual,
        descricao_atividade: payload.descricao_atividade,
        observacoes: payload.observacoes,
        cobravel: payload.cobravel,
        valor_hora: payload.valor_hora,
        status_cobranca: payload.status_cobranca,
      })
      .eq('id', id)
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

    return NextResponse.json(data as AgendaTimeEntry)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Dados inválidos' }, { status: 400 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(WRITE_ALLOWED)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id || !isUUID(id)) {
    return NextResponse.json({ error: 'ID ausente ou inválido' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: current, error: currentError } = await supabase
    .from('agenda_time_entries')
    .select('criado_por')
    .eq('id', id)
    .single()

  if (currentError || !current) {
    return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })
  }

  if (auth.role === 'advogado' && current.criado_por !== auth.userId) {
    return NextResponse.json({ error: 'Sem permissão para excluir este lançamento' }, { status: 403 })
  }

  const { error } = await supabase.from('agenda_time_entries').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}

