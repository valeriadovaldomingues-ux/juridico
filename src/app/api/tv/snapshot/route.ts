import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'

/**
 * GET /api/tv/snapshot
 * Agrega todos os indicadores necessarios para o painel TV em uma unica chamada.
 * Restrito a gerente e socio.
 */
export async function GET() {
  const auth = await apiGuard(['gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  // Inicio da semana (segunda-feira)
  const weekStart = new Date(now)
  const dow = weekStart.getDay()
  weekStart.setDate(weekStart.getDate() - (dow === 0 ? 6 : dow - 1))
  weekStart.setHours(0, 0, 0, 0)

  // 30 dias atras para movimentacao de processos
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Executa todas as queries em paralelo para minima latencia
  const [
    { count: totalOpen },
    { count: overdueCount },
    { count: dueTodayCount },
    { count: fazendoCount },
    { count: comPendenciaCount },
    { count: completedWeek },
    { count: createdToday },
    { data: openTasksRaw },
    { data: completedWeekRaw },
    { data: agendaHoje },
    { count: processosAtivos },
    { data: prazosRecentes },
  ] = await Promise.all([
    // Contadores de status
    supabase.from('kanban_tasks').select('*', { count: 'exact', head: true })
      .in('status', ['a_fazer', 'fazendo', 'com_pendencia']),

    supabase.from('kanban_tasks').select('*', { count: 'exact', head: true })
      .neq('status', 'concluido').lt('data', todayStr).not('data', 'is', null),

    supabase.from('kanban_tasks').select('*', { count: 'exact', head: true })
      .neq('status', 'concluido').eq('data', todayStr),

    supabase.from('kanban_tasks').select('*', { count: 'exact', head: true })
      .eq('status', 'fazendo'),

    supabase.from('kanban_tasks').select('*', { count: 'exact', head: true })
      .eq('status', 'com_pendencia'),

    supabase.from('kanban_tasks').select('*', { count: 'exact', head: true })
      .eq('status', 'concluido').gte('concluido_em', weekStart.toISOString()),

    supabase.from('kanban_tasks').select('*', { count: 'exact', head: true })
      .gte('created_at', todayStr + 'T00:00:00'),

    // Tarefas abertas com responsavel (para rankings de atraso e sobrecarga)
    supabase.from('kanban_tasks')
      .select('status, data, responsavel:profiles!responsavel_id(id, nome)')
      .in('status', ['a_fazer', 'fazendo', 'com_pendencia'])
      .not('responsavel_id', 'is', null),

    // Tarefas concluidas na semana com responsavel (ranking de produtividade)
    supabase.from('kanban_tasks')
      .select('responsavel:profiles!responsavel_id(id, nome)')
      .eq('status', 'concluido')
      .gte('concluido_em', weekStart.toISOString())
      .not('responsavel_id', 'is', null),

    // Agenda de hoje
    supabase.from('agenda_items')
      .select('titulo, hora_inicio, tipo')
      .eq('data_inicio', todayStr)
      .neq('status', 'cancelado')
      .order('hora_inicio', { ascending: true, nullsFirst: false })
      .limit(6),

    // Processos ativos
    supabase.from('processos').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),

    // Prazos recentes (para calcular processos com movimentacao)
    supabase.from('prazos')
      .select('processo_id')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .not('processo_id', 'is', null),
  ])

  // ── Calcular rankings a partir das tarefas abertas ──────────────────────────

  type Rank = Record<string, { nome: string; count: number }>

  const atrasadoMap: Rank = {}
  const sobreMap: Rank = {}

  for (const task of openTasksRaw ?? []) {
    const r = (task.responsavel as unknown as { id: string; nome: string } | null)
    if (!r) continue

    // Sobrecarga: todas as tarefas abertas com responsavel
    if (!sobreMap[r.id]) sobreMap[r.id] = { nome: r.nome, count: 0 }
    sobreMap[r.id].count++

    // Atraso: tarefa com data anterior a hoje e nao concluida
    if (task.data && task.data < todayStr) {
      if (!atrasadoMap[r.id]) atrasadoMap[r.id] = { nome: r.nome, count: 0 }
      atrasadoMap[r.id].count++
    }
  }

  const prodMap: Rank = {}
  for (const task of completedWeekRaw ?? []) {
    const r = (task.responsavel as unknown as { id: string; nome: string } | null)
    if (!r) continue
    if (!prodMap[r.id]) prodMap[r.id] = { nome: r.nome, count: 0 }
    prodMap[r.id].count++
  }

  const sortRank = (m: Rank) =>
    Object.values(m).sort((a, b) => b.count - a.count).slice(0, 5)

  // ── Movimentacao de processos ────────────────────────────────────────────────
  const comMovimentacao = new Set((prazosRecentes ?? []).map((p: any) => p.processo_id)).size
  const semMovimentacao = Math.max(0, (processosAtivos ?? 0) - comMovimentacao)

  return NextResponse.json({
    tasks: {
      total_open:      totalOpen      ?? 0,
      overdue:         overdueCount   ?? 0,
      due_today:       dueTodayCount  ?? 0,
      fazendo:         fazendoCount   ?? 0,
      com_pendencia:   comPendenciaCount ?? 0,
      completed_week:  completedWeek  ?? 0,
      created_today:   createdToday   ?? 0,
    },
    rankings: {
      top_atrasados:    sortRank(atrasadoMap),
      top_produtividade: sortRank(prodMap),
      sobrecarregados:  sortRank(sobreMap),
    },
    agenda_hoje: (agendaHoje ?? []).map((a: any) => ({
      titulo: a.titulo,
      hora:   a.hora_inicio ?? null,
      tipo:   a.tipo,
    })),
    processos: {
      ativos:            processosAtivos ?? 0,
      com_movimentacao:  comMovimentacao,
      sem_movimentacao:  semMovimentacao,
    },
    updated_at: new Date().toISOString(),
  })
}
