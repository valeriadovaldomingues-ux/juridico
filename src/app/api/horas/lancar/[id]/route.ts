import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isUUID } from '@/lib/portal/validate'
import { createAgendaTimeEntryPayload } from '@/lib/agenda-time-entries'
import { lerTempo } from '@/lib/horas/lancar'

// PATCH — edita QUALQUER lançamento de horas (de qualquer pessoa): descrição, data, tempo, processo, responsável,
// cobrável e observações. Quem lança horas (administrativo, advogado, gerente e sócio) também corrige. Excluir fica de fora.
// O valor por hora já gravado é preservado; o valor total é recalculado com o novo tempo.
const WRITE_ALLOWED = ['administrativo', 'advogado', 'gerente', 'socio'] as const

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard([...WRITE_ALLOWED])
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!isUUID(id)) return NextResponse.json({ error: 'Lançamento inválido.' }, { status: 400 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })

  const descricao = typeof body.descricao === 'string' ? body.descricao.trim().slice(0, 300) : ''
  if (!descricao) return NextResponse.json({ error: 'Descreva a atividade.' }, { status: 400 })
  const tempo = lerTempo(body)
  if (!tempo.ok) return NextResponse.json({ error: tempo.erro }, { status: 400 })

  const supabase = await createClient()
  const { data: atual } = await supabase
    .from('agenda_time_entries')
    .select('id, agenda_item_id, cliente_id, processo_id, criado_por, valor_hora, status_cobranca')
    .eq('id', id).maybeSingle()
  if (!atual) return NextResponse.json({ error: 'Lançamento não encontrado.' }, { status: 404 })

  // Processo: opcional; se informado, precisa ser do mesmo cliente do lançamento.
  let processoId: string | null = null
  if (body.processo_id !== undefined && body.processo_id !== null && body.processo_id !== '') {
    if (typeof body.processo_id !== 'string' || !isUUID(body.processo_id)) return NextResponse.json({ error: 'Processo inválido.' }, { status: 400 })
    const { data: proc } = await supabase.from('processos').select('id, cliente_id').eq('id', body.processo_id).maybeSingle()
    if (!proc) return NextResponse.json({ error: 'Processo não encontrado.' }, { status: 404 })
    if (proc.cliente_id !== atual.cliente_id) return NextResponse.json({ error: 'Esse processo é de outro cliente.' }, { status: 400 })
    processoId = proc.id
  }

  // Responsável ("quem fez"): opcional; usuário ativo da equipe.
  const service = createServiceClient()
  let responsavelId: string = atual.criado_por
  let responsavelNome: string | null = null
  if (typeof body.responsavel_id === 'string' && body.responsavel_id && body.responsavel_id !== atual.criado_por) {
    if (!isUUID(body.responsavel_id)) return NextResponse.json({ error: 'Responsável inválido.' }, { status: 400 })
    const { data: perfil } = await service.from('profiles').select('id, nome').eq('id', body.responsavel_id).eq('ativo', true).maybeSingle()
    if (!perfil) return NextResponse.json({ error: 'Responsável não encontrado ou inativo.' }, { status: 400 })
    responsavelId = perfil.id
    responsavelNome = perfil.nome
  }

  const cobravel = body.cobravel === undefined ? true : Boolean(body.cobravel)
  const observacoes = typeof body.observacoes === 'string' && body.observacoes.trim() ? body.observacoes.trim().slice(0, 2000) : null
  const payload = createAgendaTimeEntryPayload({
    cliente_id: atual.cliente_id, processo_id: processoId, descricao_atividade: descricao, observacoes,
    inicio_em: tempo.tempo.inicio_em, fim_em: tempo.tempo.fim_em, duracao_manual_minutos: tempo.tempo.duracao_manual_minutos,
    usa_duracao_manual: tempo.tempo.usa_duracao_manual, cobravel,
    valor_hora: atual.valor_hora, status_cobranca: atual.status_cobranca === 'faturado' ? 'faturado' : undefined,
  })

  const { data: entrada, error } = await supabase.from('agenda_time_entries').update({
    processo_id: payload.processo_id, inicio_em: payload.inicio_em, fim_em: payload.fim_em,
    duracao_calculada_minutos: payload.duracao_calculada_minutos, duracao_manual_minutos: payload.duracao_manual_minutos,
    usa_duracao_manual: payload.usa_duracao_manual, descricao_atividade: payload.descricao_atividade, observacoes: payload.observacoes,
    cobravel: payload.cobravel, status_cobranca: payload.status_cobranca, valor_total: payload.valor_total, criado_por: responsavelId,
  }).eq('id', id).select('id, cliente_id').single()
  if (error || !entrada) return NextResponse.json({ error: error?.message ?? 'Não foi possível salvar.' }, { status: 400 })

  // Mantém a tarefa da Agenda ligada a este lançamento em dia (data, processo e responsável).
  if (atual.agenda_item_id) {
    const itemPatch: Record<string, unknown> = { data_inicio: String(body.data), processo_id: processoId }
    if (responsavelNome) itemPatch.responsavel = responsavelNome
    await supabase.from('agenda_items').update(itemPatch).eq('id', atual.agenda_item_id)
  }
  return NextResponse.json({ ok: true, id: entrada.id, cliente_id: entrada.cliente_id })
}
