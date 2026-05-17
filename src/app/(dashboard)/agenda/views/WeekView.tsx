'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AgendaItem, TIPO_CFG, MESES, DIAS_SEMANA_SHORT,
  toLocalISODate, getAlertState, getWeekStart,
} from '../agenda-types'

interface Props {
  items: AgendaItem[]
  weekStart: Date
  today: string
  in3Days: string
  onPrevWeek: () => void
  onNextWeek: () => void
  onGoToday: () => void
  onEdit: (item: AgendaItem) => void
  onToggleDone: (item: AgendaItem) => void
  onNew: (date: string) => void
  onDragToDay: (itemId: string, date: string) => void
}

function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })
}

export default function WeekView({
  items, weekStart, today, in3Days,
  onPrevWeek, onNextWeek, onGoToday,
  onEdit, onToggleDone, onNew, onDragToDay,
}: Props) {
  const [dragging,  setDragging]  = useState<string | null>(null)
  const [dragOver,  setDragOver]  = useState<string | null>(null)

  const days = weekDays(weekStart)
  const startISO = toLocalISODate(weekStart)
  const endDate  = days[6]
  const endISO   = toLocalISODate(endDate)

  // Build map date→items, sorted by hora_inicio
  const byDay: Record<string, AgendaItem[]> = {}
  items.forEach(item => {
    const k = item.data_inicio
    if (!byDay[k]) byDay[k] = []
    byDay[k].push(item)
  })
  Object.values(byDay).forEach(arr =>
    arr.sort((a, b) => (a.hora_inicio ?? '99:99').localeCompare(b.hora_inicio ?? '99:99'))
  )

  // Week label
  const startLabel = `${days[0].getDate()} ${MESES[days[0].getMonth()].slice(0,3)}`
  const endLabel   = `${days[6].getDate()} ${MESES[days[6].getMonth()].slice(0,3)} ${days[6].getFullYear()}`

  const isCurrentWeek = days.some(d => toLocalISODate(d) === today)

  return (
    <div className="space-y-3">
      {/* Week nav */}
      <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm px-5 py-3.5 flex items-center gap-3">
        <button onClick={onPrevWeek} className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#E2DDD8] hover:bg-[#F0F6F6] transition-colors">
          <ChevronLeft size={15} className="text-[#4a5a6a]" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-[15px] font-bold text-[#0f1923]">{startLabel} — {endLabel}</p>
        </div>
        <button onClick={onNextWeek} className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#E2DDD8] hover:bg-[#F0F6F6] transition-colors">
          <ChevronRight size={15} className="text-[#4a5a6a]" />
        </button>
        {!isCurrentWeek && (
          <button onClick={onGoToday} className="text-[12px] font-medium text-[#0F3D3E] border border-[#E2DDD8] px-3 py-1.5 rounded-xl hover:bg-[#F0F6F6] transition-colors">
            Hoje
          </button>
        )}
      </div>

      {/* Week grid */}
      <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-[#E2DDD8]">
          {days.map((day, idx) => {
            const iso     = toLocalISODate(day)
            const isToday = iso === today
            return (
              <div
                key={idx}
                onClick={() => onNew(iso)}
                className={cn(
                  'text-center py-3 border-r border-[#F0F6F6] cursor-pointer hover:bg-[#f9fafb] transition-colors',
                  idx === 6 && 'border-r-0',
                  isToday && 'bg-emerald-50'
                )}
              >
                <p className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-wide">
                  {DIAS_SEMANA_SHORT[day.getDay()]}
                </p>
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center mx-auto mt-1',
                  isToday ? 'bg-[#1D5F60] text-white' : 'text-[#4a5a6a]'
                )}>
                  <span className="text-[13px] font-bold">{day.getDate()}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Event cells */}
        <div className="grid grid-cols-7 min-h-[320px]">
          {days.map((day, idx) => {
            const iso      = toLocalISODate(day)
            const isToday  = iso === today
            const dayItems = byDay[iso] ?? []
            const isOver   = dragOver === iso

            return (
              <div
                key={idx}
                onDragOver={e => { e.preventDefault(); setDragOver(iso) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null) }}
                onDrop={e => {
                  e.preventDefault()
                  setDragOver(null)
                  if (dragging) { onDragToDay(dragging, iso); setDragging(null) }
                }}
                onClick={() => onNew(iso)}
                className={cn(
                  'border-r border-[#F0F6F6] p-1.5 cursor-pointer transition-colors',
                  idx === 6 && 'border-r-0',
                  isToday && 'bg-emerald-50/40',
                  isOver && '!bg-emerald-50',
                )}
              >
                {dayItems.length === 0 && (
                  <div className="h-full flex items-start pt-2 justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <Plus size={13} className="text-[#c8d8d8]" />
                  </div>
                )}
                <div className="space-y-0.5">
                  {dayItems.map(item => {
                    const cfg  = TIPO_CFG[item.tipo]
                    const done = item.status === 'concluido'
                    const alert = getAlertState(item, today, in3Days)

                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={e => { e.stopPropagation(); setDragging(item.id) }}
                        onDragEnd={() => setDragging(null)}
                        onClick={e => { e.stopPropagation(); onEdit(item) }}
                        className={cn(
                          'text-[10px] font-medium px-1.5 py-1 rounded-lg truncate cursor-grab active:cursor-grabbing select-none',
                          'border-l-2',
                          cfg.chip,
                          cfg.border,
                          done && 'opacity-40 line-through',
                          alert === 'overdue' && !done && 'ring-1 ring-red-300',
                          alert === 'urgent'  && !done && 'ring-1 ring-orange-300',
                        )}
                      >
                        {item.hora_inicio && (
                          <span className="opacity-60 mr-1">{item.hora_inicio.slice(0,5)}</span>
                        )}
                        {item.titulo}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
