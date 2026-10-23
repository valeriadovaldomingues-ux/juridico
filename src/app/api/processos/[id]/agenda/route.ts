import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { isUUID } from '@/lib/portal/validate'
import { calculateSimpleSLA } from '@/lib/kanban-sla'

const ISO = /^\d{4}-\d{2}-\d{2}$/
const HORA = /^\d{2}:\d{2}$/
const PRIORIDADES = ['baixa', 'media', 'alta']

// POST — novo prazo ou nova audiência direto da tela do processo, já ligado ao processo e ao cliente.
// Prazo também ganha card no Kanban (mesmo padrão das tarefas lançadas pela ata).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(['administrativo', 'advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!isUUID(id)) return NextResponse.json({ error: 'Processo inválido.' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const tipo = body?.tipo === 'audiencia' ? 'audiencia' : body?.tipo === 'prazo' ? 'prazo' : null
  const titulo = String(body?.titulo ?? '').trim().slice(0, 160)
  const data = String(body?.data ?? '')
  const hora = body?.hora ? String(body.hora) : null
  const descricao = String(body?.descricao ?? '').trim() || null
  const prioridade = PRIORIDADES.includes(body?.prioridade) ? body.prioridade : 'media'
  const responsavelId = body?.responsavel_id && isUUID(String(body.responsavel_id)) ? String(body.responsavel_id) : null

  if (!tipo) return NextResponse.json({ error: 'Tipo inválido.' }, { status: 400 })
  if (!titulo) return NextResponse.json({ error: 'Dê um título.' }, { status: 400 })
  if (!ISO.test(data)) return NextResponse.json({ error: 'Informe a data.' }, { status: 400 })
  if (hora && !HORA.test(hora)) return NextResponse.json({ error: 'Horário inválido.' }, { status: 400 })

  const supabase = await createClient()
  const { data: processo } = await supabase
    .from('processos')
    .select('id, cliente_id, titulo, numero_processo, advogado_responsavel_id, cliente:clientes!cliente_id(nome)')
    .eq('id', id).maybeSingle()
  if (!processo) return NextResponse.json({ error: 'Processo não encontrado.' }, { status: 404 })
  const clienteNome = (Array.isArray(processo.cliente) ? processo.cliente[0]?.nome : (processo.cliente as { nome?: string } | null)?.nome) ?? null

  const respId = responsavelId ?? processo.advogado_responsavel_id ?? null
  let respNome: string | null = null
  if (respId) {
    const { data: equipe } = await supabase.rpc('perfis_equipe')
    respNome = ((equipe ?? []) as { id: string; nome: string }[]).find(p => p.id === respId)?.nome ?? null
  }

  const { data: item, error } = await supabase
    .from('agenda_items')
    .insert({
      titulo, descricao, tipo, status: 'pendente', prioridade, source: 'manual',
      data_inicio: data, hora_inicio: hora, prazo_final: tipo === 'prazo' ? data : null,
      processo_id: id, cliente_id: processo.cliente_id ?? null,
      process_number: processo.numero_processo ?? null, client_name: clienteNome,
      responsavel: respNome, responsible_user_id: respId, responsible_name: respNome,
    })
    .select('id')
    .single()
  if (error || !item) return NextResponse.json({ error: error?.message ?? 'Não foi possível salvar.' }, { status: 500 })

  let aviso: string | null = null
  if (tipo === 'prazo') {
    const { data: maxRow } = await supabase.from('kanban_tasks').select('ordem').eq('status', 'a_fazer').order('ordem', { ascending: false }).limit(1).maybeSingle()
    const sla = calculateSimpleSLA({ tipo: 'prazo', origem: 'agenda', data, status: 'a_fazer', prioridade })
    const { error: errCard } = await supabase.from('kanban_tasks').insert({
      titulo, descricao: [descricao, `Prazo do processo ${processo.numero_processo ?? processo.titulo}`].filter(Boolean).join('\n\n'),
      tipo: 'prazo', status: 'a_fazer', prioridade, origem: 'agenda', agenda_item_id: item.id,
      responsavel_id: respId, data, processo_id: id, numero_processo: processo.numero_processo ?? null,
      criado_por: auth.userId, ordem: (maxRow?.ordem ?? 0) + 1, sla_level: sla.sla_level, sla_due_at: sla.sla_due_at,
    })
    if (errCard) aviso = `Prazo salvo na Agenda, mas o card do Kanban não foi criado: ${errCard.message}`
  }

  return NextResponse.json({ id: item.id, aviso }, { status: 201 })
}
