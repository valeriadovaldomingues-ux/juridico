'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from '@dnd-kit/core'
import { ChevronDown, ChevronRight, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getKanbanTasks,
  createTask,
  updateTask,
  deleteTask,
  getOfficeColumns,
  getUnassignedTasks,
  type OfficeColumn,
} from '@/lib/kanban.service'
import PersonalBoard from './PersonalBoard'
import KanbanColumn from './KanbanColumn'
import KanbanCard from './KanbanCard'
import TaskModal from './TaskModal'
import type { KanbanTask, KanbanStatus, KanbanProfile } from '@/types/kanban'
import { STATUS_ORDER, getUserColor } from '@/types/kanban'

// Cor padrão quando o usuário não tem cor configurada
const DEFAULT_USER_COLOR = '#145A5B'

// Preferências de exibição do quadro do escritório — pessoais, por navegador
// (não sincronizam entre dispositivos nem aparecem pra outros usuários).
const LS_COLLAPSED_KEY  = 'pedv:kanban:colunas-recolhidas'
const LS_HIDE_EMPTY_KEY = 'pedv:kanban:ocultar-vazios'

function lerColapsadosSalvos(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_COLLAPSED_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function salvarColapsados(ids: Set<string>) {
  try {
    localStorage.setItem(LS_COLLAPSED_KEY, JSON.stringify([...ids]))
  } catch {
    // localStorage indisponível (modo privado, etc.) — preferência não persiste, sem quebrar a tela
  }
}

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
  const [loading,     setLoading]     = useState(true)
  const [erro,        setErro]        = useState('')

  // ── Estado do modal ─────────────────────────────────────────────────────────
  // undefined = fechado | null = novo | KanbanTask = edição
  const [modalTask,          setModalTask]          = useState<KanbanTask | null | undefined>(undefined)
  const [modalDefaultStatus, setModalDefaultStatus] = useState<KanbanStatus>('a_fazer')

  // ── Estado do DnD ───────────────────────────────────────────────────────────
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // ── Preferências de exibição (quadro do escritório) — por navegador ────────
  const [colapsados,    setColapsados]    = useState<Set<string>>(new Set())
  const [ocultarVazios, setOcultarVazios] = useState(false)

  useEffect(() => {
    setColapsados(lerColapsadosSalvos())
    setOcultarVazios(lerOcultarVazios())
  }, [])

  const alternarColapso = useCallback((id: string) => {
    setColapsados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      salvarColapsados(next)
      return next
    })
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
          supabase
            .from('profiles')
            .select('id, nome, cor_kanban, role')
            .eq('ativo', true)
            .order('nome'),
          supabase
            .from('processos')
            .select('id, titulo, numero_processo')
            .eq('status', 'ativo')
            .order('titulo'),
        ])

        if (cancelled) return

        const allProfiles = (profilesResult.data ?? []) as KanbanProfile[]
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

    const isDropZone = String(over.id).includes('::')
    if (!isDropZone) return

    const parts     = String(over.id).split('::')
    const destStatus = parts[parts.length - 1] as KanbanStatus
    const task = tasks.find(t => t.id === active.id)
    if (!task || task.status === destStatus) return

    const concluido_em = destStatus === 'concluido' ? new Date().toISOString() : null

    setTasks(prev => prev.map(t =>
      t.id === task.id ? { ...t, status: destStatus, concluido_em } : t,
    ))

    fetch(`/api/kanban-tasks/${task.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: destStatus, concluido_em }),
    })
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

  // ── Quadro do Escritório ────────────────────────────────────────────────────

  const unassignedTasks = getUnassignedTasks(tasks)
  const colVisiveis = ocultarVazios ? officeCols.filter(col => col.tasks.length > 0) : officeCols
  const mostrarUnassigned = unassignedTasks.length > 0 && (!ocultarVazios || unassignedTasks.length > 0)

  return (
    <>
      {officeCols.length > 0 && (
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
          {colapsados.size > 0 && (
            <button
              onClick={() => { setColapsados(new Set()); salvarColapsados(new Set()) }}
              className="text-[11px] text-[var(--color-copper)] font-semibold hover:underline"
            >
              Expandir todos ({colapsados.size} recolhido{colapsados.size !== 1 ? 's' : ''})
            </button>
          )}
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
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-4">
            {colVisiveis.map((col, i) => {
              const profile     = col.profile
              const userColor   = getUserColor(profile, i)
              const recolhido   = colapsados.has(profile.id)

              return (
                <div key={profile.id} className="flex flex-col gap-3 min-w-0">
                  <button
                    onClick={() => alternarColapso(profile.id)}
                    className="flex items-center gap-2.5 text-left group"
                    title={recolhido ? 'Expandir' : 'Recolher'}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[12px] font-bold shrink-0 shadow-[0_8px_18px_rgba(13,34,53,0.14)]"
                      style={{ background: userColor }}
                    >
                      {profile.nome.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[var(--color-ink)] truncate">{profile.nome}</p>
                      <p className="text-[11px] text-[var(--color-ink-3)]">
                        {col.tasks.length} tarefa{col.tasks.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {recolhido
                      ? <ChevronRight size={16} className="text-[var(--color-ink-3)] group-hover:text-[var(--color-ink)] shrink-0" />
                      : <ChevronDown  size={16} className="text-[var(--color-ink-3)] group-hover:text-[var(--color-ink)] shrink-0" />}
                  </button>

                  {!recolhido && (
                    <div className="space-y-3">
                      {STATUS_ORDER.map(status => (
                        <KanbanColumn
                          key={status}
                          userId={profile.id}
                          status={status}
                          tasks={col.tasks.filter(t => t.status === status)}
                          userColor={userColor}
                          colorMap={colorMap}
                          showResponsavel={false}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Coluna "Sem responsável" — tarefas sem atribuição */}
            {mostrarUnassigned && (() => {
              const unassignedColor = '#9ca3af'
              const recolhido = colapsados.has('__unassigned__')
              return (
                <div className="flex flex-col gap-3 min-w-0">
                  <button
                    onClick={() => alternarColapso('__unassigned__')}
                    className="flex items-center gap-2.5 text-left group"
                    title={recolhido ? 'Expandir' : 'Recolher'}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[12px] font-bold shrink-0 bg-[var(--color-ink-3)] shadow-[0_8px_18px_rgba(13,34,53,0.14)]">
                      ?
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[var(--color-ink)]">Sem responsável</p>
                      <p className="text-[11px] text-[var(--color-ink-3)]">
                        {unassignedTasks.length} tarefa{unassignedTasks.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {recolhido
                      ? <ChevronRight size={16} className="text-[var(--color-ink-3)] group-hover:text-[var(--color-ink)] shrink-0" />
                      : <ChevronDown  size={16} className="text-[var(--color-ink-3)] group-hover:text-[var(--color-ink)] shrink-0" />}
                  </button>
                  {!recolhido && (
                    <div className="space-y-3">
                      {STATUS_ORDER.map(status => (
                        <KanbanColumn
                          key={status}
                          userId="__unassigned__"
                          status={status}
                          tasks={unassignedTasks.filter(t => t.status === status)}
                          userColor={unassignedColor}
                          colorMap={colorMap}
                          showResponsavel={false}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        <DragOverlay>
          {activeTask && (
            <div className="rotate-1 scale-105 shadow-2xl">
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
          defaultStatus={modalDefaultStatus}
          onClose={() => setModalTask(undefined)}
          onSave={handleSave}
        />
      )}
    </>
  )
}
