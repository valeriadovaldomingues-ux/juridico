'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AgendaItem, TIPO_CFG, MESES, DIAS_SEMANA_SHORT,
  toLocalISODate, getAlertState, buildMonthCells,
} from '../agenda-types'

interface Props {
  items: AgendaItem[]
  year: number
  month: number
  today: string
  in3Days: string
  onPrevMonth: () => void
  onNextMonth: () => void
  onGoToday: () => void
  onDayClick: (date: string) => void
  onItemClick: (item: AgendaItem) => void
  onDragToDay: (itemId: string, date: string) => void
}

export default function MonthView({
  items, year, month, today, in3Days,
  onPrevMonth, onNextMonth, onGoToday,
  onDayClick, onItemClick, onDragToDay,
}: Props) {
  const cells = buildMonthCells(year, month)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  // Build map: date → items sorted by hora
  const byDay: Record<string, AgendaItem[]> = {}
  items.forEach(item => {
    const k = item.data_inicio
    if (!byDay[k]) byDay[k] = []
    byDay[k].push(item)
  })
  Object.values(byDay).forEach(arr =>
    arr.sort((a, b) => (a.hora_inicio ?? '99:99').localeCompare(b.hora_inicio ?? '99:99'))
  )

  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth()

  return (
    <div className="space-y-3">
      {/* Month nav */}
      <div className="flex items-center gap-3">
        <button onClick={onPrevMonth} className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#D0DCDC] hover:bg-[#F0F6F6] transition-colors">
          <ChevronLeft size={15} className="text-[#4a5a6a]" />
        </button>
        <h2 className="text-[16px] font-bold text-[#0f1923] min-w-[180px] text-center">
          {MESES[month]} {year}
        </h2>
        <button onClick={onNextMonth} className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#D0DCDC] hover:bg-[#F0F6F6] transition-colors">
          <ChevronRight size={15} className="text-[#4a5a6a]" />
        </button>
        {!isCurrentMonth && (
          <button onClick={onGoToday} className="ml-1 text-[12px] font-medium text-[#0F3D3E] border border-[#D0DCDC] px-3 py-1.5 rounded-xl hover:bg-[#F0F6F6] transition-colors">
            Hoje
          </button>
        )}
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-2xl border border-[#E8F0F0] shadow-sm overflow-hidden">
        {/* Day name headers */}
        <div className="grid grid-cols-7 border-b border-[#E8F0F0]">
          {DIAS_SEMANA_SHORT.map(d => (
            <div key={d} className="text-center text-[11px] font-semibold text-[#9aabb8] py-3 tracking-wide uppercase">
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            const iso            = toLocalISODate(cell)
            const isCurrentMo    = cell.getMonth() === month
            const isTodayCell    = iso === today
            const cellItems      = byDay[iso] ?? []
            const isOver         = dragOver === iso
            const visible        = cellItems.slice(0, 3)
            const overflow       = cellItems.length - 3

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
                onClick={() => isCurrentMo && onDayClick(iso)}
                className={cn(
                  'min-h-[96px] border-b border-r border-[#F0F6F6] p-1.5 transition-colors',
                  isCurrentMo ? 'cursor-pointer hover:bg-[#fafbfc]' : 'bg-[#fafbfc] cursor-default',
                  isOver && '!bg-emerald-50',
                  idx % 7 === 6 && 'border-r-0',
                  idx >= 35  && 'border-b-0',
                )}
              >
                {/* Day number */}
                <div className="flex justify-end mb-1">
                  <span className={cn(
                    'text-[12px] font-semibold w-6 h-6 flex items-center justify-center rounded-full',
                    isTodayCell
                      ? 'bg-[#0F3D3E] text-white'
                      : isCurrentMo ? 'text-[#4a5a6a]' : 'text-[#c8d8d8]'
                  )}>
                    {cell.getDate()}
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-0.5">
                  {visible.map(item => {
                    const cfg   = TIPO_CFG[item.tipo]
                    const done  = item.status === 'concluido'
                    const alert = getAlertState(item, today, in3Days)
                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={e => { e.stopPropagation(); setDragging(item.id) }}
                        onDragEnd={() => setDragging(null)}
                        onClick={e => { e.stopPropagation(); onItemClick(item) }}
                        title={item.titulo}
                        className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded truncate cursor-grab active:cursor-grabbing select-none border-l-2',
                          cfg.chip, cfg.border,
                          done && 'opacity-40 line-through',
                          alert === 'overdue' && !done && 'ring-1 ring-red-300',
                          alert === 'urgent'  && !done && 'ring-1 ring-orange-200',
                        )}
                      >
                        {item.hora_inicio && (
                          <span className="opacity-60 mr-1">{item.hora_inicio.slice(0,5)}</span>
                        )}
                        {item.titulo}
                      </div>
                    )
                  })}
                  {overflow > 0 && (
                    <p className="text-[9px] text-[#9aabb8] pl-1 font-medium">+{overflow} mais</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
