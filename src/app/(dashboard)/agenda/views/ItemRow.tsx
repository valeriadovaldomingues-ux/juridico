'use client'

import { AlertTriangle, Clock, AlarmClock, CheckCircle2, Trash2, CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AgendaItem, TIPO_CFG, PRIO_CFG, getAlertState, formatDateBR,
} from '../agenda-types'

export function TipoBadge({ tipo }: { tipo: AgendaItem['tipo'] }) {
  const cfg = TIPO_CFG[tipo]
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

export function AlertBadge({ state }: { state: ReturnType<typeof getAlertState> }) {
  if (state === 'overdue') return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full whitespace-nowrap">
      <AlertTriangle size={9} /> Vencido
    </span>
  )
  if (state === 'today') return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full whitespace-nowrap">
      <Clock size={9} /> Hoje
    </span>
  )
  if (state === 'urgent') return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full whitespace-nowrap">
      <AlarmClock size={9} /> Urgente
    </span>
  )
  return null
}

interface ItemRowProps {
  item:              AgendaItem
  today:             string
  in3:               string
  onEdit:            (item: AgendaItem) => void
  onToggleDone:      (item: AgendaItem) => void
  // Seleção (opcional — só ativo na ListView)
  checked?:          boolean
  onCheck?:          (id: string, checked: boolean) => void
  // Ações rápidas (opcional)
  onQuickDelete?:    (item: AgendaItem) => void
  onQuickReschedule?:(item: AgendaItem) => void
}

export default function ItemRow({
  item, today, in3, onEdit, onToggleDone,
  checked, onCheck, onQuickDelete, onQuickReschedule,
}: ItemRowProps) {
  const alert = getAlertState(item, today, in3)
  const prio  = PRIO_CFG[item.prioridade]
  const done  = item.status === 'concluido'
  const hasActions = onQuickDelete || onQuickReschedule

  return (
    <div
      className={cn(
        'group flex gap-3 px-5 py-3.5 hover:bg-[#f9fafb] transition-colors cursor-pointer',
        done && 'opacity-55',
        checked && 'bg-[#f0f7f7]',
      )}
      onClick={() => onEdit(item)}
    >
      {/* Checkbox — só aparece quando seleção está ativa */}
      {onCheck !== undefined && (
        <button
          onClick={e => { e.stopPropagation(); onCheck(item.id, !checked) }}
          className={cn(
            'flex-shrink-0 mt-0.5 w-4 h-4 rounded border-2 transition-colors flex items-center justify-center',
            checked
              ? 'bg-[#145A5B] border-[#145A5B]'
              : 'border-[#c8d8d8] hover:border-[#145A5B]',
          )}
          title={checked ? 'Desmarcar' : 'Selecionar'}
        >
          {checked && (
            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
              <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      )}

      {/* Priority bar */}
      <div className={cn('w-0.5 rounded-full flex-shrink-0 self-stretch', prio.bar)} />

      {/* Done toggle */}
      <button
        onClick={e => { e.stopPropagation(); onToggleDone(item) }}
        className={cn(
          'flex-shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 transition-colors flex items-center justify-center',
          done
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-[#c8d8d8] hover:border-emerald-400'
        )}
        title={done ? 'Marcar como pendente' : 'Marcar como concluído'}
      >
        {done && <CheckCircle2 size={11} className="text-white" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <p className={cn(
            'text-[13px] font-medium text-[#0f1923] leading-tight flex-1 min-w-0',
            done && 'line-through text-[#9aabb8]'
          )}>
            {item.titulo}
          </p>
          {!done && <AlertBadge state={alert} />}
        </div>

        <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
          <TipoBadge tipo={item.tipo} />
          <span className="text-[11px] text-[#9aabb8]">
            {formatDateBR(item.data_inicio)}
            {item.hora_inicio && ` · ${item.hora_inicio.slice(0,5)}`}
          </span>
          {item.prazo_final && item.prazo_final !== item.data_inicio && (
            <span className="text-[11px] text-orange-500 font-medium">
              Prazo: {formatDateBR(item.prazo_final)}
            </span>
          )}
          {item.processo?.titulo && (
            <span className="text-[11px] text-[#7a8899] truncate max-w-[160px]">
              {item.processo.titulo}
            </span>
          )}
          {item.responsavel && (
            <span className="text-[11px] text-[#9aabb8]">{item.responsavel}</span>
          )}
        </div>
      </div>

      {/* Ações rápidas — aparecem no hover, invisíveis por padrão */}
      {hasActions && (
        <div
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onClick={e => e.stopPropagation()}
        >
          {onQuickReschedule && (
            <button
              onClick={() => onQuickReschedule(item)}
              title="Remarcar"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9ca3af] hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <CalendarClock size={13} />
            </button>
          )}
          {onQuickDelete && (
            <button
              onClick={() => onQuickDelete(item)}
              title="Excluir"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9ca3af] hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
