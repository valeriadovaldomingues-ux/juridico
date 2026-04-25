/**
 * kanban.service.ts
 *
 * Camada de serviço do módulo Kanban.
 * Centraliza chamadas à API e funções de agrupamento de dados.
 *
 * Uso exclusivo em client components — chama /api/kanban-tasks via fetch.
 */

import type { KanbanTask, KanbanStatus, KanbanProfile } from '@/types/kanban'
import { STATUS_ORDER } from '@/types/kanban'

// ─── Tipos de saída ───────────────────────────────────────────────────────────

export interface PersonalColumn {
  status:  KanbanStatus
  label:   string
  tasks:   KanbanTask[]
}

export interface OfficeColumn {
  profile: KanbanProfile
  tasks:   KanbanTask[]
}

// ─── Agrupamento — funções puras (sem side-effects) ───────────────────────────

/**
 * Agrupa as tarefas do usuário logado por status (Quadro Pessoal).
 * Cada coluna = um estágio do fluxo de trabalho.
 */
export function getPersonalColumns(
  tasks:         KanbanTask[],
  currentUserId: string,
): PersonalColumn[] {
  const STATUS_LABELS: Record<KanbanStatus, string> = {
    a_fazer:       'A Fazer',
    fazendo:       'Fazendo',
    com_pendencia: 'Com Pendência',
    concluido:     'Concluído',
  }

  const mine = tasks.filter(t => t.responsavel_id === currentUserId)

  return STATUS_ORDER.map(status => ({
    status,
    label: STATUS_LABELS[status],
    tasks: mine
      .filter(t => t.status === status)
      .sort((a, b) => a.ordem - b.ordem),
  }))
}

/**
 * Agrupa todas as tarefas por responsável (Quadro do Escritório).
 * Cada coluna = um usuário. Ordem dos usuários vem de `profiles`.
 */
export function getOfficeColumns(
  tasks:    KanbanTask[],
  profiles: KanbanProfile[],
): OfficeColumn[] {
  return profiles.map(profile => ({
    profile,
    tasks: tasks
      .filter(t => t.responsavel_id === profile.id)
      .sort((a, b) => a.ordem - b.ordem),
  }))
}

/**
 * Retorna tarefas sem responsável atribuído.
 */
export function getUnassignedTasks(tasks: KanbanTask[]): KanbanTask[] {
  return tasks.filter(t => !t.responsavel_id).sort((a, b) => a.ordem - b.ordem)
}

// ─── Dados do escritório — banco real ─────────────────────────────────────────

/**
 * Busca profiles e tarefas do Supabase e retorna colunas do escritório.
 * Profiles são ordenados por nome; filtro por responsavel_id feito em memória.
 */
export async function getOfficeColumnsFromDB(): Promise<OfficeColumn[]> {
  const { createClient } = await import('@/lib/supabase/client')
  const supabase = createClient()

  const [profilesResult, tasksResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, nome, cor_kanban, role')
      .order('nome'),
    supabase
      .from('kanban_tasks')
      .select('*'),
  ])

  if (profilesResult.error) {
    console.error('[kanban] erro ao buscar profiles:', profilesResult.error)
    return []
  }
  if (tasksResult.error) {
    console.error('[kanban] erro ao buscar tarefas:', tasksResult.error)
    return []
  }

  return getOfficeColumns(
    (tasksResult.data  ?? []) as KanbanTask[],
    (profilesResult.data ?? []) as KanbanProfile[],
  )
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getKanbanTasks(): Promise<KanbanTask[]> {
  const res = await fetch('/api/kanban-tasks', { cache: 'no-store' })
  if (!res.ok) throw new Error('Erro ao buscar tarefas')
  return res.json()
}

export async function createTask(
  data: Omit<Partial<KanbanTask>, 'id' | 'created_at' | 'updated_at'>,
): Promise<KanbanTask> {
  const res = await fetch('/api/kanban-tasks', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Erro ao criar tarefa')
  return res.json()
}

export async function updateTaskStatus(
  id:     string,
  status: KanbanStatus,
): Promise<KanbanTask> {
  const res = await fetch(`/api/kanban-tasks/${id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error('Erro ao atualizar status')
  return res.json()
}

export async function updateTaskResponsavel(
  id:            string,
  responsavel_id: string | null,
): Promise<KanbanTask> {
  const res = await fetch(`/api/kanban-tasks/${id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ responsavel_id }),
  })
  if (!res.ok) throw new Error('Erro ao atualizar responsável')
  return res.json()
}

export async function updateTaskOrder(
  id:    string,
  ordem: number,
): Promise<void> {
  await fetch(`/api/kanban-tasks/${id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ordem }),
  })
}

export async function updateTask(
  id:   string,
  data: Partial<KanbanTask>,
): Promise<KanbanTask> {
  const res = await fetch(`/api/kanban-tasks/${id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Erro ao atualizar tarefa')
  return res.json()
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`/api/kanban-tasks/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Erro ao excluir tarefa')
}
