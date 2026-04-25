import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { calculateSimpleSLA } from '@/lib/kanban-sla'
import type { UserRole } from '@/types'

const ALLOWED: UserRole[] = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio']

/**
 * POST /api/providencia
 *
 * Cria em uma única chamada:
 *   - card no Kanban (sempre)
 *   - item na agenda/prazo (se criar_prazo = true)
 *
 * Verifica duplicata (mesma publicacao_id já tem card) e avisa,
 * mas cria assim mesmo (usuário decidiu confirmar).
 */
export async function POST(req: NextRequest) {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const {
    publicacao_id,
    titulo,
    descricao,
    responsavel_id,
    processo_id,
    numero_processo,
    partes_resumidas,
    prioridade   = 'media',
    status_kanban = 'a_fazer',
    criar_prazo   = false,
    prazo_data,
    urgencia,
  } = body

  if (!titulo?.trim()) {
    return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })
  }

  const supabase = await createClient()

  // ── Verificar duplicata ─────────────────────────────────────────────────────
  let aviso_duplicata: string | null = null
  if (publicacao_id) {
    const { data: existente } = await supabase
      .from('kanban_tasks')
      .select('id, titulo')
      .eq('publicacao_id', publicacao_id)
      .maybeSingle()

    if (existente) {
      aviso_duplicata = `Já existe um card para esta publicação: "${existente.titulo}"`
    }
  }

  // ── Calcular ordem ──────────────────────────────────────────────────────────
  const { data: maxRow } = await supabase
    .from('kanban_tasks')
    .select('ordem')
    .eq('status', status_kanban)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const ordem = maxRow ? maxRow.ordem + 1 : 0

  // ── Calcular SLA ────────────────────────────────────────────────────────────
  const sla = calculateSimpleSLA({
    tipo:       'prazo',
    origem:     'publicacao',
    data:       prazo_data   || null,
    status:     status_kanban,
    prioridade: prioridade,
  })

  // ── Criar card no Kanban ────────────────────────────────────────────────────
  const { data: kanban_task, error: errKanban } = await supabase
    .from('kanban_tasks')
    .insert({
      titulo:           titulo.trim(),
      descricao:        descricao?.trim() || null,
      status:           status_kanban,
      tipo:             'prazo',
      prioridade,
      responsavel_id:   responsavel_id || null,
      processo_id:      processo_id    || null,
      numero_processo:  numero_processo?.trim() || null,
      partes_resumidas: partes_resumidas?.trim() || null,
      publicacao_id:    publicacao_id  || null,
      origem:           'publicacao',
      data:             prazo_data     || null,
      ordem,
      sla_level:        sla.sla_level,
      sla_due_at:       sla.sla_due_at,
      updated_at:       new Date().toISOString(),
    })
    .select(`*, responsavel:profiles!responsavel_id(id, nome, cor_kanban)`)
    .single()

  if (errKanban) {
    return NextResponse.json({ error: errKanban.message }, { status: 500 })
  }

  // Registrar no histórico
  if (kanban_task) {
    await supabase.from('kanban_historico').insert({
      task_id:             kanban_task.id,
      usuario_id:          auth.userId,
      acao:                'criacao',
      para_status:         status_kanban,
      para_responsavel_id: responsavel_id || null,
    })
  }

  // ── Marcar publicação como tratada ─────────────────────────────────────────
  if (publicacao_id) {
    await supabase
      .from('publicacoes')
      .update({ status: 'tratada' })
      .eq('id', publicacao_id)
      .eq('status', 'nao_tratada')   // só atualiza se ainda não tratada
  }

  // ── Criar prazo na agenda (opcional) ───────────────────────────────────────
  let agenda_item = null
  if (criar_prazo && prazo_data) {
    const prioAgenda = prioridade === 'urgente' ? 'alta' : (prioridade as 'baixa' | 'media' | 'alta')

    const { data: agendaData } = await supabase
      .from('agenda_items')
      .insert({
        titulo:      titulo.trim(),
        descricao:   descricao?.trim() || null,
        tipo:        'prazo',
        status:      'pendente',
        prioridade:  prioAgenda,
        data_inicio: prazo_data,
        prazo_final: prazo_data,
        processo_id: processo_id || null,
        responsavel: responsavel_id || null,  // agenda usa text mas salvamos o id por enquanto
      })
      .select('id, titulo, data_inicio')
      .single()

    agenda_item = agendaData
  }

  return NextResponse.json({
    kanban_task,
    agenda_item,
    aviso_duplicata,
  }, { status: 201 })
}
