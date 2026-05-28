'use client'

import { AlertTriangle, Clock, AlarmClock, CheckCircle2, Loader2, Trash2 } from 'lucide-react'
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

export default function ItemRow({
  item, today, in3, onEdit, onToggleDone, onDelete, canDelete, isDeleting = false,
}: {
  item: AgendaItem
  today: string
  in3: string
  onEdit: (item: AgendaItem) => void
  onToggleDone: (item: AgendaItem) => void
  onDelete: (item: AgendaItem) => void
  canDelete: boolean
  isDeleting?: boolean
}) {
  const alert = getAlertState(item, today, in3)
  const prio  = PRIO_CFG[item.prioridade]
  const done  = item.status === 'concluido'

  return (
    <div
      className={cn(
        'group flex gap-3 px-5 py-3.5 hover:bg-[var(--color-petrol-light)]/35 transition-colors cursor-pointer',
        done && 'opacity-55'
      )}
      onClick={() => onEdit(item)}
    >
      {/* Priority bar */}
      <div className={cn('w-0.5 rounded-full flex-shrink-0 self-stretch', prio.bar)} />

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <p className={cn(
            'text-[13px] font-semibold text-[var(--color-ink)] leading-tight flex-1 min-w-0',
            done && 'line-through text-[var(--color-ink-3)]'
          )}>
            {item.titulo}
          </p>
          {!done && <AlertBadge state={alert} />}
        </div>

        <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
          <TipoBadge tipo={item.tipo} />
          <span className="text-[11px] text-[var(--color-ink-3)]">
            {formatDateBR(item.data_inicio)}
            {item.hora_inicio && ` · ${item.hora_inicio.slice(0,5)}`}
          </span>
          {item.prazo_final && item.prazo_final !== item.data_inicio && (
            <span className="text-[11px] text-orange-500 font-medium">
              Prazo: {formatDateBR(item.prazo_final)}
            </span>
          )}
          {item.processo?.titulo && (
            <span className="text-[11px] text-[var(--color-ink-2)] truncate max-w-[160px]">
              {item.processo.titulo}
            </span>
          )}
          {item.responsavel && (
            <span className="text-[11px] text-[var(--color-ink-3)]">{item.responsavel}</span>
          )}
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1.5 self-center">
        {canDelete && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(item) }}
            disabled={isDeleting}
            title="Excluir evento"
            aria-label={`Excluir evento ${item.titulo}`}
            className="w-7 h-7 rounded-lg border border-[var(--color-border)] bg-white text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </button>
        )}

        {/* Done toggle */}
        <button
          onClick={e => { e.stopPropagation(); onToggleDone(item) }}
          className={cn(
            'flex-shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 transition-colors flex items-center justify-center',
            done
              ? 'bg-emerald-500 border-emerald-500'
              : 'border-[#c8d8d8] hover:border-emerald-400'
          )}
        >
          {done && <CheckCircle2 size={11} className="text-white" />}
        </button>
      </div>
    </div>
  )
}
