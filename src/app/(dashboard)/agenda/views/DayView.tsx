'use client'

import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AgendaItem, TIPO_CFG, PRIO_CFG, DIAS_SEMANA_LONG, MESES,
  formatDateBR, getAlertState, toLocalISODate,
} from '../agenda-types'
import { AlertBadge, TipoBadge } from './ItemRow'

interface Props {
  items: AgendaItem[]
  date: string
  today: string
  in3Days: string
  onPrev: () => void
  onNext: () => void
  onGoToday: () => void
  onEdit: (item: AgendaItem) => void
  onToggleDone: (item: AgendaItem) => void
  onNew: (date: string) => void
}

function parseDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt  = new Date(y, m - 1, d)
  const dow = DIAS_SEMANA_LONG[dt.getDay()]
  return `${dow}, ${d} de ${MESES[m - 1]}`
}

export default function DayView({
  items, date, today, in3Days,
  onPrev, onNext, onGoToday, onEdit, onToggleDone, onNew,
}: Props) {
  const dayItems = items
    .filter(i => i.data_inicio === date)
    .sort((a, b) => {
      if (!a.hora_inicio && !b.hora_inicio) return 0
      if (!a.hora_inicio) return 1
      if (!b.hora_inicio) return -1
      return a.hora_inicio.localeCompare(b.hora_inicio)
    })

  const untimed = dayItems.filter(i => !i.hora_inicio)
  const timed   = dayItems.filter(i => !!i.hora_inicio)

  const isToday = date === today

  return (
    <div className="space-y-4">
      {/* Day nav */}
      <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm px-5 py-4 flex items-center gap-3">
        <button onClick={onPrev} className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#E2DDD8] hover:bg-[#F0F6F6] transition-colors">
          <ChevronLeft size={15} className="text-[#4a5a6a]" />
        </button>
        <div className="flex-1 text-center">
          <p className={cn('text-[17px] font-bold', isToday ? 'text-[#0F3D3E]' : 'text-[#0f1923]')}>
            {parseDateLabel(date)}
            {isToday && <span className="ml-2 text-[11px] font-semibold text-[#0F3D3E] bg-emerald-50 px-2 py-0.5 rounded-full">Hoje</span>}
          </p>
        </div>
        <button onClick={onNext} className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#E2DDD8] hover:bg-[#F0F6F6] transition-colors">
          <ChevronRight size={15} className="text-[#4a5a6a]" />
        </button>
        {!isToday && (
          <button onClick={onGoToday} className="text-[12px] font-medium text-[#0F3D3E] border border-[#E2DDD8] px-3 py-1.5 rounded-xl hover:bg-[#F0F6F6] transition-colors">
            Hoje
          </button>
        )}
      </div>

      {dayItems.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm p-10 text-center">
          <CalendarDays size={28} className="text-[#c8d8d8] mx-auto mb-3" />
          <p className="text-[14px] font-medium text-[#7a8899]">Nenhum item para este dia</p>
          <button
            onClick={() => onNew(date)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#1D5F60] text-white text-[13px] font-semibold rounded-xl hover:bg-[#145A5B] transition-colors"
          >
            <Plus size={13} /> Adicionar item
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Sem horário */}
          {untimed.length > 0 && (
            <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-[#F0F6F6]">
                <p className="text-[11px] font-semibold text-[#9aabb8] uppercase tracking-wide">Dia todo / Sem horário</p>
              </div>
              <div className="divide-y divide-[#f5f7fa]">
                {untimed.map(item => <DayItemCard key={item.id} item={item} today={today} in3={in3Days} onEdit={onEdit} onToggleDone={onToggleDone} />)}
              </div>
            </div>
          )}

          {/* Com horário */}
          {timed.length > 0 && (
            <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-[#F0F6F6]">
                <p className="text-[11px] font-semibold text-[#9aabb8] uppercase tracking-wide">Agendados</p>
              </div>
              <div className="divide-y divide-[#f5f7fa]">
                {timed.map(item => <DayItemCard key={item.id} item={item} today={today} in3={in3Days} onEdit={onEdit} onToggleDone={onToggleDone} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick add at bottom */}
      <button
        onClick={() => onNew(date)}
        className="w-full py-3 rounded-lg border-2 border-dashed border-[#E2DDD8] text-[13px] text-[#9aabb8] font-medium hover:border-[#0F3D3E] hover:text-[#0F3D3E] hover:bg-[#f9fafb] transition-all flex items-center justify-center gap-2"
      >
        <Plus size={14} /> Adicionar para este dia
      </button>
    </div>
  )
}

function DayItemCard({
  item, today, in3, onEdit, onToggleDone,
}: {
  item: AgendaItem; today: string; in3: string
  onEdit: (i: AgendaItem) => void
  onToggleDone: (i: AgendaItem) => void
}) {
  const alert = getAlertState(item, today, in3)
  const prio  = PRIO_CFG[item.prioridade]
  const done  = item.status === 'concluido'
  const cfg   = TIPO_CFG[item.tipo]

  return (
    <div
      onClick={() => onEdit(item)}
      className={cn(
        'flex gap-4 px-5 py-4 hover:bg-[#f9fafb] transition-colors cursor-pointer',
        done && 'opacity-55'
      )}
    >
      {/* Time column */}
      <div className="w-14 flex-shrink-0 text-center">
        {item.hora_inicio ? (
          <>
            <p className="text-[13px] font-bold text-[#0f1923]">{item.hora_inicio.slice(0,5)}</p>
            {item.hora_fim && <p className="text-[10px] text-[#9aabb8]">{item.hora_fim.slice(0,5)}</p>}
          </>
        ) : (
          <p className="text-[11px] text-[#c8d8d8]">—</p>
        )}
      </div>

      {/* Color bar */}
      <div className={cn('w-1 rounded-full flex-shrink-0 self-stretch', cfg.dot.replace('bg-', 'bg-'))} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <p className={cn('text-[13px] font-semibold text-[#0f1923] flex-1', done && 'line-through text-[#9aabb8]')}>
            {item.titulo}
          </p>
          {!done && <AlertBadge state={alert} />}
        </div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <TipoBadge tipo={item.tipo} />
          {item.processo?.titulo && (
            <span className="text-[11px] text-[#7a8899] truncate max-w-[200px]">{item.processo.titulo}</span>
          )}
          {item.responsavel && (
            <span className="text-[11px] text-[#9aabb8]">{item.responsavel}</span>
          )}
        </div>
        {item.descricao && (
          <p className="text-[12px] text-[#9aabb8] mt-1 line-clamp-1">{item.descricao}</p>
        )}
      </div>

      {/* Toggle done */}
      <button
        onClick={e => { e.stopPropagation(); onToggleDone(item) }}
        className={cn(
          'flex-shrink-0 self-center w-5 h-5 rounded-full border-2 transition-colors flex items-center justify-center',
          done ? 'bg-emerald-500 border-emerald-500' : 'border-[#c8d8d8] hover:border-emerald-400'
        )}
      >
        {done && <span className="text-white text-[10px]">✓</span>}
      </button>
    </div>
  )
}
