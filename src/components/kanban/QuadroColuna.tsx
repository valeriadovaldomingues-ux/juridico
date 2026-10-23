'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Archive, ChevronsLeft, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KanbanTask, KanbanStatus } from '@/types/kanban'
import { STATUS_ORDER } from '@/types/kanban'
import { sortBySLA } from '@/lib/kanban-sla'
import KanbanCard from './KanbanCard'

interface Props {
  /** Dono da coluna: id da pessoa, `__list__<id>` (lista do Trello) ou `__unassigned__`. */
  id:             string
  nome:           string
  cor:            string
  tasks:          KanbanTask[]
  colorMap:       Record<string, string>
  onEdit:         (task: KanbanTask) => void
  onDelete:       (id: string) => void
  onArchive:      (ids: string[]) => void
  onStatusChange: (task: KanbanTask, status: KanbanStatus) => void
  onAdd?:         () => void
  /** Coluna recolhida: vira uma faixa estreita com o nome na vertical. */
  recolhida?:     boolean
  onToggleRecolher?: () => void
}

/**
 * Coluna no estilo Trello: uma pessoa (ou lista) por coluna, com todos os cards
 * empilhados. O status de cada card aparece e se troca no próprio card; concluídos
 * ficam no fim da coluna e podem ser arquivados.
 */
export default function QuadroColuna({ id, nome, cor, tasks, colorMap, onEdit, onDelete, onArchive, onStatusChange, onAdd, recolhida = false, onToggleRecolher }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `${id}::todos` })

  // Em andamento primeiro (mais urgentes no topo), concluídos no fim.
  const ordenadas = STATUS_ORDER.flatMap(st => sortBySLA(tasks.filter(t => t.status === st)))
  const concluidas = tasks.filter(t => t.status === 'concluido')

  // Recolhida: só o nome na vertical (e a contagem). Continua aceitando cartões soltos nela;
  // clicar na faixa abre a coluna de novo.
  if (recolhida) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col items-center gap-2 w-11 min-w-11 shrink-0 py-2 rounded-2xl bg-[var(--color-surface-warm)]/80 border border-[var(--color-border)] transition-colors',
          isOver && 'bg-[var(--color-petrol-light)] ring-2 ring-inset ring-[var(--color-copper)]/25',
        )}
      >
        <button
          type="button"
          onClick={onToggleRecolher}
          title={`Abrir a coluna de ${nome}`}
          className="flex flex-col items-center gap-2 w-full px-1 hover:opacity-80 transition-opacity"
        >
          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: cor }}>
            {nome.slice(0, 2).toUpperCase()}
          </span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white text-[var(--color-ink-2)] ring-1 ring-[var(--color-border)]">{tasks.length}</span>
          <span
            className="text-[12px] font-bold text-[var(--color-ink)] whitespace-nowrap max-h-[260px] overflow-hidden text-ellipsis"
            style={{ writingMode: 'vertical-rl' }}
          >
            {nome}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-[300px] min-w-[300px] max-h-[calc(100vh-230px)] rounded-2xl bg-[var(--color-surface-warm)]/80 border border-[var(--color-border)]">
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-2 shrink-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0"
          style={{ background: cor }}
        >
          {nome.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-[var(--color-ink)] truncate">{nome}</p>
          <p className="text-[11px] text-[var(--color-ink-3)]">
            {tasks.length} cartão{tasks.length !== 1 ? 'ões' : ''}
          </p>
        </div>
        {onToggleRecolher && (
          <button
            type="button"
            onClick={onToggleRecolher}
            title="Recolher esta coluna (fica só o nome na vertical)"
            className="p-1 rounded-md text-[var(--color-ink-3)] hover:bg-white hover:text-[var(--color-ink)] transition-colors shrink-0"
          >
            <ChevronsLeft size={14} />
          </button>
        )}
        {concluidas.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm(`Arquivar ${concluidas.length} card${concluidas.length > 1 ? 's' : ''} concluído${concluidas.length > 1 ? 's' : ''} de ${nome}? Eles saem do quadro e ficam em "Ver arquivadas".`)) {
                onArchive(concluidas.map(t => t.id))
              }
            }}
            title="Arquivar os concluídos desta coluna"
            className="flex items-center gap-1 text-[9px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-1 rounded-full ring-1 ring-emerald-200 transition-colors shrink-0"
          >
            <Archive size={9} /> {concluidas.length} concluído{concluidas.length > 1 ? 's' : ''}
          </button>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[80px] rounded-b-2xl transition-colors',
          isOver && 'bg-[var(--color-petrol-light)] ring-2 ring-inset ring-[var(--color-copper)]/25',
        )}
      >
        <SortableContext items={ordenadas.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {ordenadas.map(task => (
            <KanbanCard
              key={task.id}
              task={task}
              userColor={colorMap[task.responsavel_id ?? ''] ?? cor}
              onEdit={onEdit}
              onDelete={onDelete}
              onArchive={cardId => onArchive([cardId])}
              onStatusChange={onStatusChange}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="h-16 rounded-lg border-2 border-dashed border-[var(--color-border)] flex items-center justify-center">
            <span className="text-[11px] text-[var(--color-ink-3)]">Solte um cartão aqui</span>
          </div>
        )}
      </div>

      {onAdd && (
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium text-[var(--color-ink-3)] hover:text-[var(--color-ink)] hover:bg-white/60 rounded-b-2xl transition-colors shrink-0"
        >
          <Plus size={13} /> Adicionar cartão
        </button>
      )}
    </div>
  )
}
