'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Calendar, AlertTriangle, ExternalLink, Newspaper,
  GripVertical, Trash2, Pencil, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KanbanTask } from '@/types/kanban'
import { PRIORIDADE_CFG } from '@/types/kanban'
import { getTaskSLABadge } from '@/lib/kanban-sla'

function todayISO() { return new Date().toISOString().slice(0, 10) }
function fmtDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

interface Props {
  task:             KanbanTask
  userColor:        string
  showResponsavel?: boolean
  onEdit:           (task: KanbanTask) => void
  onDelete:         (id: string) => void
}

export default function KanbanCard({ task, userColor, showResponsavel, onEdit, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  const style: React.CSSProperties = {
    transform:   CSS.Transform.toString(transform),
    transition,
    borderLeftColor: userColor,
  }

  const today     = todayISO()
  const vencido   = !!task.data && task.data < today && task.status !== 'concluido'
  const venceHoje = task.data === today && task.status !== 'concluido'
  const pri       = PRIORIDADE_CFG[task.prioridade]
  const sla       = getTaskSLABadge(task)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative bg-white rounded-xl border border-l-4 select-none',
        'transition-shadow duration-150',
        isDragging
          ? 'opacity-40 shadow-xl border-[#e5e7eb]'
          : 'shadow-sm hover:shadow-md border-[#e5e7eb]',
        // SLA sobrescreve borda se tiver status ativo
        sla.borderCls
          ? sla.borderCls
          : vencido
            ? '!border-l-red-400'
            : venceHoje
              ? '!border-l-orange-400'
              : '',
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-5 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical size={13} className="text-[#c5cdd8]" />
      </div>

      <div className="pl-5 pr-3 py-3 space-y-2">

        {/* Badges superiores */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {task.origem === 'publicacao' && (
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded-full ring-1 ring-violet-200">
              <Newspaper size={8} /> Publicação
            </span>
          )}
          <span className={cn('inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full', pri.bg, pri.text)}>
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', pri.dot)} />
            {pri.label}
          </span>
          {/* Badge SLA */}
          {sla.show && (
            <span className={cn(
              'inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full',
              sla.badgeCls,
            )}>
              <AlertTriangle size={8} />
              {sla.label}
            </span>
          )}
        </div>

        {/* Título */}
        <p className="text-[13px] font-semibold text-[#0f1923] leading-snug line-clamp-2">
          {task.titulo}
        </p>

        {/* Processo / partes */}
        {(task.numero_processo || task.partes_resumidas || task.processo) && (
          <div className="space-y-0.5">
            {(task.numero_processo || task.processo?.numero_processo) && (
              <p className="text-[10px] font-mono text-[#7a8899] truncate">
                {task.numero_processo ?? task.processo?.numero_processo}
              </p>
            )}
            {task.partes_resumidas && (
              <p className="text-[11px] text-[#4a5a6a] truncate">{task.partes_resumidas}</p>
            )}
            {!task.partes_resumidas && task.processo?.titulo && (
              <p className="text-[11px] text-[#4a5a6a] truncate">{task.processo.titulo}</p>
            )}
          </div>
        )}

        {/* Pendência */}
        {task.status === 'com_pendencia' && task.pendencia_motivo && (
          <div className="flex items-start gap-1.5 bg-orange-50 rounded-lg px-2 py-1.5">
            <AlertTriangle size={10} className="text-orange-500 mt-0.5 shrink-0" />
            <p className="text-[10px] text-orange-700 leading-relaxed">{task.pendencia_motivo}</p>
          </div>
        )}

        {/* Prazo */}
        {task.data && (
          <div className={cn(
            'flex items-center gap-1.5 text-[10px] font-medium rounded-lg px-2 py-1',
            vencido   ? 'bg-red-50 text-red-600'       :
            venceHoje ? 'bg-orange-50 text-orange-600' :
                        'bg-[#f9fafb] text-[#6b7280]',
          )}>
            {vencido ? <AlertTriangle size={10} /> : <Calendar size={10} />}
            {vencido ? 'Vencido · ' : venceHoje ? 'Hoje · ' : ''}
            {fmtDate(task.data)}
          </div>
        )}

        {/* Concluído em */}
        {task.status === 'concluido' && task.concluido_em && (
          <div className="flex items-center gap-1.5 text-[10px] text-[#9ca3af]">
            <Clock size={9} />
            Concluído {fmtDate(task.concluido_em)}
          </div>
        )}

        {/* Responsável — visível no modo Geral */}
        {showResponsavel && task.responsavel && (
          <div className="flex items-center gap-1.5">
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0"
              style={{ background: task.responsavel.cor_kanban ?? '#9ca3af' }}
            >
              {task.responsavel.nome.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-[10px] text-[#7a8899] truncate">{task.responsavel.nome}</span>
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center justify-between pt-1 border-t border-[#f3f4f6]">
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(task)}
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[#f3f4f6] text-[#9ca3af] hover:text-[#374151] transition-colors"
            >
              <Pencil size={11} />
            </button>
            {task.publicacao_id && (
              <button
                title="Ver publicação"
                onClick={() => window.open('/publicacoes', '_blank')}
                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-violet-50 text-[#9ca3af] hover:text-violet-600 transition-colors"
              >
                <ExternalLink size={11} />
              </button>
            )}
            <button
              onClick={() => onDelete(task.id)}
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 text-[#9ca3af] hover:text-red-500 transition-colors"
            >
              <Trash2 size={11} />
            </button>
          </div>
          {task.area_juridica && (
            <span className="text-[9px] text-[#9ca3af] truncate max-w-[80px]">{task.area_juridica}</span>
          )}
        </div>
      </div>
    </div>
  )
}
