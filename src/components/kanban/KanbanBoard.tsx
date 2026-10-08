'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from '@dnd-kit/core'
import { EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getKanbanTasks,
  createTask,
  updateTask,
  deleteTask,
  getOfficeColumns,
  getListColumns,
  getUnassignedTasks,
  resolverDestinoOffice,
  ordenarColunasTrello,
  type OfficeColumn,
  type ListaMapeada,
} from '@/lib/kanban.service'
import PersonalBoard from './PersonalBoard'
import QuadroColuna from './QuadroColuna'
import KanbanCard from './KanbanCard'
import TaskModal from './TaskModal'
import type { KanbanTask, KanbanStatus, KanbanProfile } from '@/types/kanban'
import { getUserColor } from '@/types/kanban'

// Cor padrão quando o usuário não tem cor configurada
const DEFAULT_USER_COLOR = '#145A5B'

// Preferência de exibição do quadro do escritório — pessoal, por navegador
// (não sincroniza entre dispositivos nem aparece pra outros usuários).
const LS_HIDE_EMPTY_KEY = 'pedv:kanban:ocultar-vazios'

function lerOcultarVazios(): boolean {
  try {
    return localStorage.getItem(LS_HIDE_EMPTY_KEY) === 'true'
  } catch {
    return false
  }
}

interface Processo { id: string; titulo: string; numero_processo?: string | null }

export default function KanbanBoard({ view }: { view: 'personal' | 'office' }) {
  // ── Estado dos dados ────────────────────────────────────────────────────────
  const [tasks,       setTasks]       = useState<KanbanTask[]>([])
  const [currentUser, setCurrentUser] = useState<KanbanProfile | null>(null)
  const [profiles,    setProfiles]    = useState<KanbanProfile[]>([])
  const [processos,   setProcessos]   = useState<Processo[]>([])
  const [officeCols,  setOfficeCols]  = useState<OfficeColumn[]>([])
  const [listasMapeadas, setListasMapeadas] = useState<ListaMapeada[]>([])
  const [loading,     setLoading]     = useState(true)
  const [erro,        setErro]        = useState('')

  // ── Estado do modal ─────────────────────────────────────────────────────────
  // undefined = fechado | null = novo | KanbanTask = edição
  const [modalTask,          setModalTask]          = useState<KanbanTask | null | undefined>(undefined)
  const [modalDefaultStatus, setModalDefaultStatus] = useState<KanbanStatus>('a_fazer')
  const [modalDefaultResponsavel, setModalDefaultResponsavel] = useState<string | undefined>(undefined)

  // ── Estado do DnD ───────────────────────────────────────────────────────────
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // ── Preferências de exibição (quadro do escritório) — por navegador ────────
  const [ocultarVazios, setOcultarVazios] = useState(false)

  useEffect(() => {
    setOcultarVazios(lerOcultarVazios())
  }, [])

  const alternarOcultarVazios = useCallback(() => {
    setOcultarVazios(prev => {
      const next = !prev
      try { localStorage.setItem(LS_HIDE_EMPTY_KEY, String(next)) } catch { /* preferência não persiste */ }
      return next
    })
  }, [])

  // ── Mapa de cores dos perfis (índice garante cor elegante quando null) ──────
  const colorMap: Record<string, string> = {}
  profiles.forEach((p, i) => { colorMap[p.id] = getUserColor(p, i) })

  // ── Carregamento inicial ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setErro('')
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { if (!cancelled) setErro('Usuário não autenticado.'); return }

        const [tasksData, profilesResult, processosResult] = await Promise.all([
          getKanbanTasks(),
          // Função perfis_equipe (só id/nome/cor/cargo): a tabela profiles só deixa
          // advogados e estagiários verem o próprio perfil, o que escondia o resto da equipe.
          supabase.rpc('perfis_equipe'),
          supabase
            .from('processos')
            .select('id, titulo, numero_processo')
            .eq('status', 'ativo')
            .order('titulo'),
        ])

        if (cancelled) return

        const allProfiles = ((profilesResult.data ?? []) as KanbanProfile[])
          .slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        const allProcessos = (processosResult.data ?? []) as Processo[]

        setTasks(tasksData as KanbanTask[])
        setProfiles(allProfiles)
        setProcessos(allProcessos)

        // Perfil do usuário logado — com fallback seguro para cor_kanban
        const userProfile = allProfiles.find(p => p.id === user.id) ?? {
          id:         user.id,
          nome:       user.email?.split('@')[0] ?? 'Usuário',
          cor_kanban: DEFAULT_USER_COLOR,
          role:       'estagiario',
        }
        setCurrentUser({
          ...userProfile,
          cor_kanban: userProfile.cor_kanban ?? DEFAULT_USER_COLOR,
        })

        if (view === 'office') {
          setOfficeCols(getOfficeColumns(tasksData as KanbanTask[], allProfiles))
          // Listas do Trello mapeadas (para mostrar também as vazias, na ordem do Trello)
          const { data: mapeadas } = await supabase
            .from('trello_list_mappings')
            .select('trello_list_id, trello_list_name, profile_id, kanban_status, posicao')
          if (!cancelled) {
            setListasMapeadas((mapeadas ?? []).map((m: { trello_list_id: string; trello_list_name: string | null; profile_id: string | null; kanban_status: string; posicao: number | null }) => ({
              id: m.trello_list_id, nome: m.trello_list_name ?? '', pos: m.posicao, profileId: m.profile_id, status: m.kanban_status,
            })).filter(m => m.nome))
          }
        }
      } catch (err) {
        console.error('[KanbanBoard] erro ao carregar:', err)
        if (!cancelled) setErro('Erro ao carregar o Kanban. Tente recarregar a página.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [view])

  // Sincroniza as colunas do escritório quando tasks ou profiles mudam
  useEffect(() => {
    if (view === 'office' && profiles.length > 0) {
      setOfficeCols(getOfficeColumns(tasks, profiles))
    }
  }, [tasks, profiles, view])

  // ── Callbacks ───────────────────────────────────────────────────────────────

  const handleTasksChange = useCallback((updated: KanbanTask[]) => {
    setTasks(updated)
  }, [])

  const handleEdit = useCallback((task: KanbanTask) => {
    setModalTask(task)
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    try {
      await deleteTask(id)
    } catch (err) {
      console.error('[KanbanBoard] erro ao excluir tarefa:', err)
      // Recarrega para consistência
      getKanbanTasks().then(data => setTasks(data as KanbanTask[]))
    }
  }, [])

  // Arquivar cards concluídos (qualquer perfil): saem do quadro e ficam em "Ver arquivadas".
  const handleArchive = useCallback(async (ids: string[]) => {
    const alvo = new Set(ids)
    setTasks(prev => prev.filter(t => !alvo.has(t.id)))
    try {
      const respostas = await Promise.all(ids.map(id =>
        fetch(`/api/kanban-tasks/${id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ arquivado: true }),
        }),
      ))
      if (respostas.some(r => !r.ok)) throw new Error('falha ao arquivar')
    } catch (err) {
      console.error('[KanbanBoard] erro ao arquivar:', err)
      // Recarrega para refletir o que realmente foi arquivado
      getKanbanTasks().then(data => setTasks(data as KanbanTask[]))
    }
  }, [])

  // Trocar o status direto no card (quadro estilo Trello, sem colunas de status).
  const handleStatusChange = useCallback((task: KanbanTask, status: KanbanStatus) => {
    if (task.status === status) return
    const anterior = tasks
    const concluido_em = status === 'concluido' ? new Date().toISOString() : null
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status, concluido_em } : t))
    fetch(`/api/kanban-tasks/${task.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
    }).then(res => { if (!res.ok) setTasks(anterior) }).catch(() => setTasks(anterior))
  }, [tasks])

  const handleAddParaPessoa = useCallback((responsavelId?: string) => {
    setModalDefaultStatus('a_fazer')
    setModalDefaultResponsavel(responsavelId)
    setModalTask(null)
  }, [])

  const handleAddTask = useCallback((status: KanbanStatus) => {
    setModalDefaultStatus(status)
    setModalTask(null) // null = novo
  }, [])

  const handleSave = useCallback(async (data: Partial<KanbanTask>) => {
    if (modalTask === null) {
      // Criação — atribui ao usuário logado se não definido
      const payload = {
        ...data,
        responsavel_id: data.responsavel_id ?? currentUser?.id ?? null,
      }
      const newTask = await createTask(payload)
      setTasks(prev => [...prev, newTask as KanbanTask])
    } else if (modalTask) {
      // Edição
      const updated = await updateTask(modalTask.id, data)
      setTasks(prev => prev.map(t => t.id === modalTask.id ? (updated as KanbanTask) : t))
    }
  }, [modalTask, currentUser])

  // DnD — quadro pessoal (PersonalBoard gerencia internamente, aqui só sync state)
  const handlePersonalDragStart = useCallback((task: KanbanTask) => {
    setActiveTask(task)
  }, [])

  const handlePersonalDragEnd = useCallback((_event: DragEndEvent) => {
    setActiveTask(null)
    // PersonalBoard já faz o PATCH e chama onTasksChange — sem duplicação.
  }, [])

  // DnD — quadro do escritório (gerenciado aqui)
  function handleOfficeDragStart({ active }: DragStartEvent) {
    setActiveTask(tasks.find(t => t.id === active.id) ?? null)
  }

  function handleOfficeDragEnd(event: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const task = tasks.find(t => t.id === active.id)
    if (!task) return

    // Soltar na área vazia da coluna ("pessoa::status") ou em cima de outro card —
    // o destino inclui QUEM é o dono da coluna, então arrastar para a coluna de outra
    // pessoa reatribui o card (antes só o status mudava e o dono era ignorado).
    const destino = resolverDestinoOffice(String(over.id), tasks, profiles.map(p => p.id))
    if (!destino) return

    const mudouStatus = destino.status !== null && destino.status !== task.status
    const mudouDono   = destino.responsavelId !== null && destino.responsavelId !== task.responsavel_id
    if (!mudouStatus && !mudouDono) return

    const concluido_em = mudouStatus ? (destino.status === 'concluido' ? new Date().toISOString() : null) : task.concluido_em ?? null
    const anterior = tasks

    setTasks(prev => prev.map(t =>
      t.id === task.id
        ? { ...t, ...(mudouStatus && destino.status ? { status: destino.status } : {}), concluido_em, ...(mudouDono ? { responsavel_id: destino.responsavelId } : {}) }
        : t,
    ))

    fetch(`/api/kanban-tasks/${task.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        ...(mudouStatus ? { status: destino.status } : {}),
        ...(mudouDono   ? { responsavel_id: destino.responsavelId } : {}),
      }),
    }).then(res => { if (!res.ok) setTasks(anterior) }).catch(() => setTasks(anterior))
  }

  // ── Loading / Erro ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-[var(--color-ink-3)] text-[13px] shadow-[0_12px_36px_rgba(13,34,53,0.04)]">
        Carregando…
      </div>
    )
  }

  if (erro) {
    return (
      <div className="py-8 px-4 text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-2xl text-center">
        {erro}
      </div>
    )
  }

  // ── Quadro Pessoal ──────────────────────────────────────────────────────────

  if (view === 'personal') {
    if (!currentUser) {
      return (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-8 text-center text-[13px] text-[var(--color-ink-3)]">
          Usuário não autenticado.
        </div>
      )
    }

    return (
      <>
        <PersonalBoard
          tasks={tasks}
          currentUser={currentUser}
          onTasksChange={handleTasksChange}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onArchive={handleArchive}
          onAddTask={handleAddTask}
          activeTask={activeTask}
          onDragStart={handlePersonalDragStart}
          onDragEnd={handlePersonalDragEnd}
        />
        {modalTask !== undefined && (
          <TaskModal
            task={modalTask}
            profiles={profiles}
            processos={processos}
            defaultResponsavelId={currentUser.id}
            defaultStatus={modalDefaultStatus}
            onClose={() => setModalTask(undefined)}
            onSave={handleSave}
          />
        )}
      </>
    )
  }

  // ── Quadro do Escritório (estilo Trello: uma coluna por pessoa, lado a lado) ─

  const unassignedTasks = getUnassignedTasks(tasks)
  const listCols        = getListColumns(tasks, listasMapeadas)
  const colVisiveis     = ocultarVazios ? officeCols.filter(col => col.tasks.length > 0) : officeCols
  const listColsVisiveis = ocultarVazios ? listCols.filter(col => col.tasks.length > 0) : listCols
  const mostrarUnassigned = unassignedTasks.length > 0
  // Mesma ordem de colunas do Trello (pessoas e listas intercaladas pela posição da lista)
  const colunasOrdenadas = ordenarColunasTrello(colVisiveis, listColsVisiveis, tasks, listasMapeadas)

  return (
    <>
      {(officeCols.length > 0 || listCols.length > 0) && (
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <label className="flex items-center gap-2 text-[12px] text-[var(--color-ink-2)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={ocultarVazios}
              onChange={alternarOcultarVazios}
              className="rounded border-[var(--color-border)]"
            />
            <EyeOff size={13} className="text-[var(--color-ink-3)]" />
            Ocultar quem não tem tarefas
          </label>
          <p className="text-[11px] text-[var(--color-ink-3)]">Arraste para o lado para ver todo mundo · arraste um cartão para outra coluna para trocar o responsável</p>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleOfficeDragStart}
        onDragEnd={handleOfficeDragEnd}
      >
        {officeCols.length === 0 ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-center text-[13px] text-[var(--color-ink-3)]">
            Nenhum colaborador ativo encontrado.
          </div>
        ) : (
          <div className="flex items-start gap-4 overflow-x-auto pb-4">
            {colunasOrdenadas.map(item => item.tipo === 'pessoa' ? (
              <QuadroColuna
                key={item.col.profile.id}
                id={item.col.profile.id}
                nome={item.col.profile.nome}
                cor={getUserColor(item.col.profile, officeCols.findIndex(c => c.profile.id === item.col.profile.id))}
                tasks={item.col.tasks}
                colorMap={colorMap}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onArchive={handleArchive}
                onStatusChange={handleStatusChange}
                onAdd={() => handleAddParaPessoa(item.col.profile.id)}
              />
            ) : (
              <QuadroColuna
                key={item.col.key}
                id={`__list__${item.col.key}`}
                nome={item.col.nome}
                cor={getUserColor({ id: item.col.key, nome: item.col.nome, cor_kanban: null, role: '' }, officeCols.length + item.indice)}
                tasks={item.col.tasks}
                colorMap={colorMap}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onArchive={handleArchive}
                onStatusChange={handleStatusChange}
              />
            ))}

            {mostrarUnassigned && (
              <QuadroColuna
                id="__unassigned__"
                nome="Sem responsável"
                cor="#9ca3af"
                tasks={unassignedTasks}
                colorMap={colorMap}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onArchive={handleArchive}
                onStatusChange={handleStatusChange}
                onAdd={() => handleAddParaPessoa(undefined)}
              />
            )}
          </div>
        )}

        <DragOverlay>
          {activeTask && (
            <div className="rotate-1 scale-105 shadow-2xl w-[284px]">
              <KanbanCard
                task={activeTask}
                userColor={colorMap[activeTask.responsavel_id ?? ''] ?? DEFAULT_USER_COLOR}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {modalTask !== undefined && (
        <TaskModal
          task={modalTask}
          profiles={profiles}
          processos={processos}
          defaultResponsavelId={modalDefaultResponsavel}
          defaultStatus={modalDefaultStatus}
          onClose={() => setModalTask(undefined)}
          onSave={handleSave}
        />
      )}
    </>
  )
}
