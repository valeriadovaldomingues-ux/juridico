import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { calculateSimpleSLA } from '@/lib/kanban-sla'

// Quem recebe as iniciais prontas para revisar/corrigir: Cristiano Pessoa (sócio).
const REVISOR_USER_ID = '2027c26e-a4fa-4195-99b4-992550163024'

const ALLOWED: import('@/types').UserRole[] = ['estagiario', 'advogado', 'gerente', 'socio']

/**
 * POST /api/iniciais/:id/concluir
 *
 * Conclui a inicial (card do Kanban) e abre uma tarefa "REVISAR INICIAL" no Kanban
 * do Cristiano — que também aparece no painel do Dashboard dele. Idempotente: concluir
 * de novo não duplica a tarefa de revisão (índice único origem + origem_id).
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = await createClient()

  const { data: card } = await supabase
    .from('kanban_tasks')
    .select('id, titulo, status, categoria, origem, tipo, data, prioridade, partes_resumidas, numero_processo, responsavel_id, trello_list_nome, arquivado')
    .eq('id', id)
    .maybeSingle()

  if (!card) return NextResponse.json({ error: 'Inicial não encontrada.' }, { status: 404 })
  if (card.categoria !== 'inicial') {
    // Cards vindos do Trello têm status/responsável reescritos pela sincronização diária:
    // concluir aqui seria desfeito na manhã seguinte. Esses se concluem no próprio Trello.
    return NextResponse.json({ error: 'Só dá para concluir aqui as iniciais cadastradas no sistema. As do Trello são concluídas no Trello.' }, { status: 400 })
  }

  // Quem fez: o responsável do card; se não houver, quem está concluindo.
  const { data: perfis } = await supabase
    .from('profiles').select('id, nome').in('id', [card.responsavel_id, auth.userId].filter(Boolean) as string[])
  const nomeDe = (uid: string | null) => perfis?.find(p => p.id === uid)?.nome
  const feitaPor = nomeDe(card.responsavel_id) ?? card.trello_list_nome ?? nomeDe(auth.userId) ?? 'a equipe'

  const agora = new Date().toISOString()

  if (card.status !== 'concluido') {
    const sla = calculateSimpleSLA({
      tipo: card.tipo, origem: card.origem, data: card.data, status: 'concluido', prioridade: card.prioridade,
    })
    const { error } = await supabase.from('kanban_tasks').update({
      status: 'concluido', concluido_em: agora, updated_at: agora,
      sla_level: sla.sla_level, sla_due_at: sla.sla_due_at,
    }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('kanban_historico').insert({
      task_id: id, usuario_id: auth.userId, acao: 'status', de_status: card.status, para_status: 'concluido',
    })
  }

  // Tarefa de revisão no Kanban do Cristiano (uma por inicial)
  const origemId = `revisao-inicial:${id}`
  const { data: jaExiste } = await supabase
    .from('kanban_tasks').select('id').eq('origem', 'manual').eq('origem_id', origemId).maybeSingle()

  let revisaoCriada = false
  if (!jaExiste) {
    const { data: maxRow } = await supabase
      .from('kanban_tasks').select('ordem').eq('status', 'a_fazer').order('ordem', { ascending: false }).limit(1).maybeSingle()
    const resumo = card.partes_resumidas ?? card.titulo
    const dataBR = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const { error } = await supabase.from('kanban_tasks').insert({
      titulo: `REVISAR INICIAL — ${resumo}`,
      descricao: `Inicial concluída por ${feitaPor} em ${dataBR}. Revisar e corrigir.\nCard original: ${card.titulo}`,
      tipo: 'tarefa', status: 'a_fazer', prioridade: 'alta',
      responsavel_id: REVISOR_USER_ID,
      partes_resumidas: card.partes_resumidas, numero_processo: card.numero_processo,
      origem: 'manual', origem_id: origemId, criado_por: auth.userId,
      ordem: (maxRow?.ordem ?? 0) + 1,
    })
    if (error && error.code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 })
    revisaoCriada = !error
  }

  return NextResponse.json({ ok: true, revisaoCriada })
}
