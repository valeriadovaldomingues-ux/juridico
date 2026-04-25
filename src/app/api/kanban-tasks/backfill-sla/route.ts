// ─────────────────────────────────────────────────────────────────────────────
// POST /api/kanban-tasks/backfill-sla
//
// Preenche sla_level e sla_due_at de tarefas sem SLA calculado.
// Processar em lotes para não travar o banco.
// Acesso: apenas gerente / sócio.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { calculateSimpleSLA } from '@/lib/kanban-sla'

const ALLOWED: import('@/types').UserRole[] = ['gerente', 'socio']
const LOTE = 100

export async function POST() {
  const auth = await apiGuard(ALLOWED)
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()

  // Busca todas as tarefas sem SLA calculado
  const { data: tasks, error } = await supabase
    .from('kanban_tasks')
    .select('id, tipo, origem, data, prioridade, status')
    .is('sla_due_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ message: 'Nenhuma tarefa sem SLA encontrada.', updated: 0 })
  }

  let updated = 0
  let errors  = 0

  for (let i = 0; i < tasks.length; i += LOTE) {
    const lote = tasks.slice(i, i + LOTE)

    for (const task of lote) {
      const sla = calculateSimpleSLA({
        tipo:       task.tipo       ?? null,
        origem:     task.origem     ?? 'manual',
        data:       task.data       ?? null,
        status:     task.status,
        prioridade: task.prioridade ?? null,
      })

      const { error: upErr } = await supabase
        .from('kanban_tasks')
        .update({
          sla_level:  sla.sla_level,
          sla_due_at: sla.sla_due_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id)

      if (upErr) {
        console.error('[backfill-sla] erro na task', task.id, upErr.message)
        errors++
      } else {
        updated++
      }
    }
  }

  return NextResponse.json({
    message: `Backfill concluído: ${updated} tarefas atualizadas, ${errors} erros.`,
    total:   tasks.length,
    updated,
    errors,
  })
}
