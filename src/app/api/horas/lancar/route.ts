import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isUUID } from '@/lib/portal/validate'
import { createAgendaTimeEntryPayload } from '@/lib/agenda-time-entries'
import { lerTempo } from '@/lib/horas/lancar'

// POST — lança horas (timesheet). Com ou sem processo: consultoria e outros trabalhos do cliente entram só com o cliente.
// O sistema guarda cada lançamento como uma tarefa concluída na agenda + o registro de tempo (a estrutura que o relatório
// de horas por cliente já usa).
const WRITE_ALLOWED = ['administrativo', 'advogado', 'gerente', 'socio'] as const

export async function POST(req: NextRequest) {
  const auth = await apiGuard([...WRITE_ALLOWED])
  if (auth instanceof NextResponse) return auth
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })

  const descricao = typeof body.descricao === 'string' ? body.descricao.trim().slice(0, 300) : ''
  if (!descricao) return NextResponse.json({ error: 'Descreva a atividade.' }, { status: 400 })
  const tempo = lerTempo(body)
  if (!tempo.ok) return NextResponse.json({ error: tempo.erro }, { status: 400 })

  const processoId = typeof body.processo_id === 'string' && body.processo_id ? body.processo_id : null
  let clienteId = typeof body.cliente_id === 'string' && body.cliente_id ? body.cliente_id : null
  if ((processoId && !isUUID(processoId)) || (clienteId && !isUUID(clienteId))) return NextResponse.json({ error: 'Cliente ou processo inválido.' }, { status: 400 })

  const supabase = await createClient()
  if (processoId) {
    const { data: proc } = await supabase.from('processos').select('id, cliente_id').eq('id', processoId).maybeSingle()
    if (!proc) return NextResponse.json({ error: 'Processo não encontrado.' }, { status: 404 })
    clienteId = proc.cliente_id ?? clienteId // o cliente do processo manda
  }
  if (!clienteId) return NextResponse.json({ error: 'Escolha o cliente (ou um processo).' }, { status: 400 })

  // Nome de quem lança (a agenda guarda o responsável como texto)
  const { data: perfil } = await createServiceClient().from('profiles').select('nome').eq('id', auth.userId).maybeSingle()
  const data = String(body.data)
  const observacoes = typeof body.observacoes === 'string' && body.observacoes.trim() ? body.observacoes.trim().slice(0, 2000) : null

  const { data: item, error: e1 } = await supabase.from('agenda_items').insert({
    titulo: descricao, descricao: [observacoes, '[lançado no controle de horas]'].filter(Boolean).join('\n\n'), tipo: 'tarefa', status: 'concluido',
    data_inicio: data, prioridade: 'media', processo_id: processoId, cliente_id: clienteId, responsavel: perfil?.nome ?? null,
  }).select('id').single()
  if (e1 || !item) return NextResponse.json({ error: e1?.message ?? 'Não foi possível registrar.' }, { status: 400 })

  const cobravel = body.cobravel === undefined ? true : Boolean(body.cobravel)
  // Valor por hora: só sócio informa (os valores não circulam para o resto da equipe)
  const valorHora = auth.role === 'socio' && body.valor_hora !== undefined && body.valor_hora !== null && body.valor_hora !== '' && Number.isFinite(Number(body.valor_hora)) ? Number(body.valor_hora) : null

  const payload = createAgendaTimeEntryPayload({
    agenda_item_id: item.id, cliente_id: clienteId, processo_id: processoId, descricao_atividade: descricao, observacoes,
    inicio_em: tempo.tempo.inicio_em, fim_em: tempo.tempo.fim_em, duracao_manual_minutos: tempo.tempo.duracao_manual_minutos,
    usa_duracao_manual: tempo.tempo.usa_duracao_manual, cobravel, valor_hora: valorHora,
  })
  const { data: entrada, error: e2 } = await supabase.from('agenda_time_entries').insert({ ...payload, criado_por: auth.userId })
    .select('*, cliente:clientes(id, nome), processo:processos(id, titulo, numero_processo), criado_por_profile:profiles!criado_por(id, nome)').single()
  if (e2 || !entrada) {
    await supabase.from('agenda_items').delete().eq('id', item.id) // desfaz a tarefa criada
    return NextResponse.json({ error: e2?.message ?? 'Não foi possível registrar.' }, { status: 400 })
  }
  return NextResponse.json(entrada, { status: 201 })
}
