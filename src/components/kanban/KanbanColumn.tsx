'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import type { KanbanTask, KanbanStatus } from '@/types/kanban'
import { STATUS_LABELS } from '@/types/kanban'
import { sortBySLA } from '@/lib/kanban-sla'
import KanbanCard from './KanbanCard'

const COL_STYLE: Record<KanbanStatus, { header: string; dot: string; empty: string }> = {
  a_fazer:       { header: 'text-[#4a5a6a]',  dot: 'bg-slate-400',  empty: 'border-slate-200' },
  fazendo:       { header: 'text-blue-700',   dot: 'bg-blue-500',   empty: 'border-blue-200'  },
  com_pendencia: { header: 'text-orange-700', dot: 'bg-orange-500', empty: 'border-orange-200'},
  concluido:     { header: 'text-emerald-700',dot: 'bg-emerald-500',empty: 'border-emerald-200'},
}

interface Props {
  userId?:         string
  status:          KanbanStatus
  tasks:           KanbanTask[]
  userColor:       string
  colorMap?:       Record<string, string>
  showResponsavel?: boolean
  onEdit:          (task: KanbanTask) => void
  onDelete:        (id: string) => void
}

export default function KanbanColumn({ userId = 'geral', status, tasks, userColor, colorMap, showResponsavel, onEdit, onDelete }: Props) {
  const droppableId = `${userId}::${status}`
  const { setNodeRef, isOver } = useDroppable({ id: droppableId })
  const style = COL_STYLE[status]

  // Ordenar por SLA: critico → atencao → normal; depois por prazo mais próximo
  const sortedTasks = sortBySLA(tasks)

  // Contadores para o header da coluna
  const overdueCount = tasks.filter(t => t.sla_level === 'critico').length
  const warningCount = tasks.filter(t => t.sla_level === 'atencao').length

  return (
    <div className="flex flex-col min-w-0">
      {/* Cabeçalho da coluna */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={cn('w-2 h-2 rounded-full shrink-0', style.dot)} />
        <span className={cn('text-[11px] font-bold uppercase tracking-wider', style.header)}>
          {STATUS_LABELS[status]}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {overdueCount > 0 && (
            <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full ring-1 ring-red-200">
              {overdueCount} atrasada{overdueCount > 1 ? 's' : ''}
            </span>
          )}
          {warningCount > 0 && overdueCount === 0 && (
            <span className="text-[9px] font-bold text-yellow-700 bg-yellow-50 px-1.5 py-0.5 rounded-full ring-1 ring-yellow-200">
              {warningCount} atenção
            </span>
          )}
          <span className="text-[10px] font-semibold text-[#9ca3af] bg-[#f3f4f6] px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Zona de drop */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-xl p-2 space-y-2 min-h-[120px] transition-colors duration-150',
          isOver ? 'bg-[#f0f9f9] ring-2 ring-[#145A5B]/20' : 'bg-[#f9fafb]',
        )}
      >
        <SortableContext items={sortedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {sortedTasks.map(task => (
            <KanbanCard
              key={task.id}
              task={task}
              userColor={colorMap?.[task.responsavel_id ?? ''] ?? userColor}
              showResponsavel={showResponsavel}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className={cn(
            'h-16 rounded-lg border-2 border-dashed flex items-center justify-center',
            isOver ? 'border-[#145A5B]/40 bg-[#e8f0f0]' : style.empty,
          )}>
            <span className="text-[11px] text-[#c5cdd8]">Solte aqui</span>
          </div>
        )}
      </div>
    </div>
  )
}
