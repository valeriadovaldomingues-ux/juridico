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

/**
 * Coluna derivada de uma lista do Trello que não representa uma pessoa
 * (ex.: PRAZOS CÍVEIS, CONCLUÍDOS) — mesmo tratamento visual de uma
 * coluna de pessoa no Quadro do Escritório, sem exigir um profile real.
 */
export interface ListColumn {
  key:   string   // trello_list_id
  nome:  string   // trello_list_nome
  tasks: KanbanTask[]
  pos?:  number   // posição da lista no Trello (quando conhecida)
}

/** Lista do Trello mapeada no sistema (trello_list_mappings) — usada para mostrar
 *  também as colunas vazias, como o Trello faz. */
export interface ListaMapeada {
  id:        string
  nome:      string
  pos:       number | null
  profileId: string | null   // preenchido quando a lista é de uma pessoa
  status:    string          // 'ignorar' = não entra no quadro
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
 * Agrupa tarefas sem responsável que vieram de uma lista do Trello mapeada
 * como categoria (ex.: PRAZOS CÍVEIS, CONCLUÍDOS) em colunas próprias —
 * mesmo padrão visual de uma coluna de pessoa, ordenadas por nome.
 */
export function getListColumns(tasks: KanbanTask[], mapeadas: ListaMapeada[] = []): ListColumn[] {
  const porLista = new Map<string, { nome: string; tasks: KanbanTask[] }>()

  for (const t of tasks) {
    if (t.responsavel_id || !t.trello_list_id || !t.trello_list_nome) continue
    const entry = porLista.get(t.trello_list_id) ?? { nome: t.trello_list_nome, tasks: [] }
    entry.tasks.push(t)
    porLista.set(t.trello_list_id, entry)
  }

  // Listas do Trello que não são de uma pessoa continuam aparecendo mesmo vazias
  // (ex.: CONCLUÍDOS depois que seus cards são arquivados no Trello).
  for (const m of mapeadas) {
    if (m.profileId || m.status === 'ignorar' || porLista.has(m.id)) continue
    porLista.set(m.id, { nome: m.nome, tasks: [] })
  }
  const posDaLista = new Map(mapeadas.map(m => [m.id, m.pos]))

  return Array.from(porLista.entries())
    .map(([key, { nome, tasks }]) => ({
      key,
      nome,
      tasks: tasks.sort((a, b) => a.ordem - b.ordem),
      pos: posDaLista.get(key) ?? undefined,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export type ColunaOrdenada =
  | { tipo: 'pessoa'; col: OfficeColumn }
  | { tipo: 'lista';  col: ListColumn; indice: number }

/**
 * Ordena as colunas do Quadro do Escritório na mesma ordem das listas do Trello
 * (posição gravada em `trello_list_pos` pela sincronização). Pessoa e lista entram
 * na mesma sequência; a lista de uma pessoa é achada pelo primeiro nome ("Tuane"
 * ↔ "Tuane Miranda"). Quem não tem posição conhecida vai para o fim, em ordem alfabética.
 */
export function ordenarColunasTrello(
  pessoas: OfficeColumn[],
  listas:  ListColumn[],
  tasks:   KanbanTask[],
  mapeadas: ListaMapeada[] = [],
): ColunaOrdenada[] {
  const posPorNomeLista = new Map<string, number>()
  for (const t of tasks) {
    if (t.trello_list_nome && typeof t.trello_list_pos === 'number') {
      posPorNomeLista.set(semAcento(t.trello_list_nome), t.trello_list_pos)
    }
  }

  const itens: (ColunaOrdenada & { pos: number; nome: string })[] = [
    ...pessoas.map(col => ({
      tipo: 'pessoa' as const, col, nome: col.profile.nome,
      pos: mapeadas.find(m => m.profileId === col.profile.id)?.pos
        ?? posPorNomeLista.get(semAcento(col.profile.nome).split(/\s+/)[0])
        ?? Infinity,
    })),
    ...listas.map((col, indice) => ({
      tipo: 'lista' as const, col, indice, nome: col.nome,
      pos: col.pos ?? col.tasks.find(t => typeof t.trello_list_pos === 'number')?.trello_list_pos ?? Infinity,
    })),
  ]

  return itens
    .sort((a, b) => (a.pos === b.pos ? a.nome.localeCompare(b.nome, 'pt-BR') : a.pos - b.pos))
    .map(({ pos: _pos, nome: _nome, ...resto }) => resto as ColunaOrdenada)
}

/**
 * Resolve para onde um card foi solto no Quadro do Escritório.
 *
 * Cada coluna é "<dono>::todos" (quadro estilo Trello) ou "<dono>::<status>" (dono = id de pessoa, id de lista do Trello ou
 * "__unassigned__"). Soltar EM CIMA de outro card vale como soltar na coluna dele.
 * `responsavelId` só vem preenchido quando o destino é a coluna de uma PESSOA —
 * é isso que reatribui o card; colunas de lista/sem responsável só mudam o status.
 */
export function resolverDestinoOffice(
  overId:     string,
  tasks:      KanbanTask[],
  profileIds: string[],
): { status: KanbanStatus | null; responsavelId: string | null } | null {
  const donoPessoa = (dono: string | null | undefined) => (dono && profileIds.includes(dono) ? dono : null)

  if (overId.includes('::')) {
    const [dono, status] = overId.split('::')
    // "todos" = coluna estilo Trello (sem status): só reatribui, o status não muda.
    if (status === 'todos') return { status: null, responsavelId: donoPessoa(dono) }
    if (!STATUS_ORDER.includes(status as KanbanStatus)) return null
    return { status: status as KanbanStatus, responsavelId: donoPessoa(dono) }
  }
  const alvo = tasks.find(t => t.id === overId)
  if (!alvo) return null
  // Soltar em cima de um card = soltar na coluna dele (a pessoa dele), sem mexer no status.
  return { status: null, responsavelId: donoPessoa(alvo.responsavel_id) }
}

/**
 * Retorna tarefas sem responsável atribuído e sem lista de origem mapeada
 * (ex.: tarefas manuais criadas sem atribuição) — as vindas de uma lista
 * do Trello mapeada como categoria já aparecem em getListColumns().
 */
export function getUnassignedTasks(tasks: KanbanTask[]): KanbanTask[] {
  return tasks
    .filter(t => !t.responsavel_id && !t.trello_list_nome)
    .sort((a, b) => a.ordem - b.ordem)
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

/** Por padrão retorna só as tarefas ativas (não arquivadas). */
export async function getKanbanTasks(opts?: { arquivadas?: boolean }): Promise<KanbanTask[]> {
  const qs = opts?.arquivadas ? '?arquivadas=true' : ''
  const res = await fetch(`/api/kanban-tasks${qs}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Erro ao buscar tarefas')
  return res.json()
}

/** Arquiva ou restaura uma tarefa (some do board sem apagar o histórico). */
export async function setTaskArquivado(id: string, arquivado: boolean): Promise<KanbanTask> {
  const res = await fetch(`/api/kanban-tasks/${id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ arquivado }),
  })
  if (!res.ok) throw new Error('Erro ao arquivar/restaurar tarefa')
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
