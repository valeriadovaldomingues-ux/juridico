'use client'

import { useRef } from 'react'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import KanbanCard from './KanbanCard'
import type { KanbanTask, KanbanStatus, KanbanProfile } from '@/types/kanban'
import { getPersonalColumns } from '@/lib/kanban.service'

// ─── Paleta das colunas ───────────────────────────────────────────────────────
const COL_PALETTE: Record<KanbanStatus, {
  header: string; dot: string; ring: string; dropBg: string; emptyBorder: string
}> = {
  a_fazer:       { header: 'text-slate-600',   dot: 'bg-slate-400',   ring: 'ring-slate-200',   dropBg: 'bg-slate-50/80',   emptyBorder: 'border-slate-200'  },
  fazendo:       { header: 'text-blue-700',    dot: 'bg-blue-500',    ring: 'ring-blue-200',    dropBg: 'bg-blue-50/60',    emptyBorder: 'border-blue-200'   },
  com_pendencia: { header: 'text-orange-700',  dot: 'bg-orange-500',  ring: 'ring-orange-200',  dropBg: 'bg-orange-50/60',  emptyBorder: 'border-orange-200' },
  concluido:     { header: 'text-emerald-700', dot: 'bg-emerald-500', ring: 'ring-emerald-200', dropBg: 'bg-emerald-50/60', emptyBorder: 'border-emerald-200'},
}

// ─── Coluna droppable ─────────────────────────────────────────────────────────
function PersonalColumn({
  status, label, tasks, userColor, onEdit, onDelete, onAddTask,
}: {
  status:    KanbanStatus
  label:     string
  tasks:     KanbanTask[]
  userColor: string
  onEdit:    (t: KanbanTask) => void
  onDelete:  (id: string) => void
  onAddTask: (status: KanbanStatus) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `personal::${status}` })
  const pal = COL_PALETTE[status]

  return (
    <div className="flex flex-col w-[280px] min-w-[280px]">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', pal.dot)} />
        <span className={cn('text-[11px] font-bold uppercase tracking-wider flex-1', pal.header)}>
          {label}
        </span>
        <span className="text-[10px] font-semibold text-[#9ca3af] bg-[#f3f4f6] px-1.5 py-0.5 rounded-full">
          {tasks.length}
        </span>
        <button
          onClick={() => onAddTask(status)}
          className="w-5 h-5 flex items-center justify-center rounded-md text-[#c5cdd8] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
          title={`Nova tarefa em ${label}`}
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Zona de drop */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-2xl p-2 space-y-2 min-h-[400px] transition-all duration-150',
          isOver
            ? cn('ring-2', pal.ring, pal.dropBg)
            : 'bg-[#f3f4f6]',
        )}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <KanbanCard
              key={task.id}
              task={task}
              userColor={userColor}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div
            className={cn(
              'h-20 rounded-xl border-2 border-dashed flex items-center justify-center transition-colors',
              isOver
                ? cn('border-opacity-60', pal.dot.replace('bg-', 'border-'), 'bg-white/40')
                : pal.emptyBorder,
            )}
          >
            <span className="text-[11px] text-[#c5cdd8]">
              {isOver ? 'Solte aqui' : 'Nenhuma tarefa'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PersonalBoard ────────────────────────────────────────────────────────────
interface Props {
  tasks:         KanbanTask[]
  currentUser:   KanbanProfile
  onTasksChange: (tasks: KanbanTask[]) => void
  onEdit:        (task: KanbanTask) => void
  onDelete:      (id: string) => void
  onAddTask:     (status: KanbanStatus) => void
  activeTask:    KanbanTask | null
  onDragStart:   (task: KanbanTask) => void
  onDragEnd:     (event: DragEndEvent) => void
}

export default function PersonalBoard({
  tasks, currentUser, onTasksChange, onEdit, onDelete, onAddTask,
  activeTask, onDragStart, onDragEnd,
}: Props) {
  const sensors   = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const userColor = currentUser.cor_kanban ?? '#145A5B'
  const columns   = getPersonalColumns(tasks, currentUser.id)

  const patchQueue = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleDragStart({ active }: DragStartEvent) {
    const task = tasks.find(t => t.id === active.id)
    if (task) onDragStart(task)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    onDragEnd(event)  // propaga para o board pai registrar no banco

    if (!over || active.id === over.id) return

    const isColumn = String(over.id).startsWith('personal::')

    if (isColumn) {
      // Drop em coluna: muda status
      const destStatus = String(over.id).replace('personal::', '') as KanbanStatus
      const task = tasks.find(t => t.id === active.id)
      if (!task || task.status === destStatus) return

      onTasksChange(tasks.map(t =>
        t.id === task.id
          ? { ...t, status: destStatus, concluido_em: destStatus === 'concluido' ? new Date().toISOString() : null }
          : t,
      ))

      if (patchQueue.current) clearTimeout(patchQueue.current)
      patchQueue.current = setTimeout(() => {
        fetch(`/api/kanban-tasks/${task.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ status: destStatus }),
        })
      }, 300)
    } else {
      // Drop em card: reordenar dentro da mesma coluna
      const draggedTask = tasks.find(t => t.id === active.id)
      const targetTask  = tasks.find(t => t.id === over.id)
      if (!draggedTask || !targetTask || draggedTask.status !== targetTask.status) return

      const statusTasks = tasks.filter(t => t.status === draggedTask.status)
      const oldIdx      = statusTasks.findIndex(t => t.id === draggedTask.id)
      const newIdx      = statusTasks.findIndex(t => t.id === targetTask.id)
      const reordered   = arrayMove(statusTasks, oldIdx, newIdx).map((t, i) => ({ ...t, ordem: i }))

      onTasksChange(tasks.map(t => {
        const r = reordered.find(rt => rt.id === t.id)
        return r ?? t
      }))
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Identidade do usuário */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[13px] font-bold shrink-0"
          style={{ background: userColor }}
        >
          {currentUser.nome.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="text-[14px] font-bold text-[#0f1923]">{currentUser.nome}</p>
          <p className="text-[11px] text-[#9ca3af]">
            {tasks.filter(t => t.responsavel_id === currentUser.id).length} tarefa
            {tasks.filter(t => t.responsavel_id === currentUser.id).length !== 1 ? 's' : ''} atribuídas
          </p>
        </div>
      </div>

      {/* 4 colunas horizontais */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(col => (
          <PersonalColumn
            key={col.status}
            status={col.status}
            label={col.label}
            tasks={col.tasks}
            userColor={userColor}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddTask={onAddTask}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="rotate-1 scale-105 shadow-2xl">
            <KanbanCard
              task={activeTask}
              userColor={userColor}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
