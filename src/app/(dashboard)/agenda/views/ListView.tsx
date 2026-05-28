'use client'

import { useState } from 'react'
import { Plus, CalendarDays, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AgendaItem } from '../agenda-types'
import ItemRow from './ItemRow'

function GroupSection({
  title, count, colorClass, items, today, in3, onEdit, onToggleDone, onDelete, canDelete, deletingId, defaultOpen = true,
}: {
  title: string; count: number; colorClass: string
  items: AgendaItem[]; today: string; in3: string
  onEdit: (i: AgendaItem) => void
  onToggleDone: (i: AgendaItem) => void
  onDelete: (i: AgendaItem) => void
  canDelete: boolean
  deletingId: string | null
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (items.length === 0) return null

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-[0_12px_36px_rgba(13,34,53,0.05)] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-5 py-3.5 border-b border-[var(--color-border)] hover:bg-[var(--color-petrol-light)]/35 transition-colors"
      >
        <h2 className="font-brand text-[20px] font-semibold text-[var(--color-ink)] flex-1 text-left">{title}</h2>
        <span className={cn('text-[11px] font-semibold px-2.5 py-0.5 rounded-full', colorClass)}>{count}</span>
        <ChevronRight size={13} className={cn('text-[#9aabb8] transition-transform', open && 'rotate-90')} />
      </button>
      {open && (
        <div className="divide-y divide-[#f5f7fa]">
          {items.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              today={today}
              in3={in3}
              onEdit={onEdit}
              onToggleDone={onToggleDone}
              onDelete={onDelete}
              canDelete={canDelete}
              isDeleting={deletingId === item.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  items: AgendaItem[]
  today: string
  in3Days: string
  in7Days: string
  onEdit: (item: AgendaItem) => void
  onToggleDone: (item: AgendaItem) => void
  onDelete: (item: AgendaItem) => void
  canDelete: boolean
  deletingId: string | null
  onNew: () => void
}

export default function ListView({
  items, today, in3Days, in7Days, onEdit, onToggleDone, onDelete, canDelete, deletingId, onNew,
}: Props) {
  const pendentes = items.filter(i => i.status === 'pendente')
  const vencidos   = pendentes.filter(i => (i.prazo_final ?? i.data_inicio) < today)
  const deHoje     = pendentes.filter(i => i.data_inicio === today && !vencidos.includes(i))
  const estaSemana = pendentes.filter(i => i.data_inicio > today && i.data_inicio <= in7Days)
  const proximos   = pendentes.filter(i => i.data_inicio > in7Days)
  const concluidos = items.filter(i => i.status === 'concluido')
  const cancelados = items.filter(i => i.status === 'cancelado')

  if (items.length === 0) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-[0_12px_36px_rgba(13,34,53,0.05)] p-12 text-center">
        <CalendarDays size={32} className="text-[var(--color-copper)] mx-auto mb-3" />
        <p className="font-brand text-[24px] font-semibold text-[var(--color-ink)]">Nenhum item encontrado</p>
        <p className="text-[13px] text-[var(--color-ink-3)] mt-1">Ajuste os filtros ou crie um novo compromisso.</p>
        <button
          onClick={onNew}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-sidebar)] text-white text-[13px] font-semibold rounded-xl hover:bg-[var(--color-petrol)] transition-colors shadow-sm"
        >
          <Plus size={13} /> Criar item
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <GroupSection title="Vencidos" count={vencidos.length}
        colorClass="bg-red-50 text-red-600" items={vencidos}
        today={today} in3={in3Days} onEdit={onEdit} onToggleDone={onToggleDone}
        onDelete={onDelete} canDelete={canDelete} deletingId={deletingId} />

      <GroupSection title="Hoje" count={deHoje.length}
        colorClass="bg-amber-50 text-amber-700" items={deHoje}
        today={today} in3={in3Days} onEdit={onEdit} onToggleDone={onToggleDone}
        onDelete={onDelete} canDelete={canDelete} deletingId={deletingId} />

      <GroupSection title="Esta semana" count={estaSemana.length}
        colorClass="bg-blue-50 text-blue-600" items={estaSemana}
        today={today} in3={in3Days} onEdit={onEdit} onToggleDone={onToggleDone}
        onDelete={onDelete} canDelete={canDelete} deletingId={deletingId} />

      <GroupSection title="Próximos" count={proximos.length}
        colorClass="bg-[#E8F2F2] text-[#4a5a6a]" items={proximos}
        today={today} in3={in3Days} onEdit={onEdit} onToggleDone={onToggleDone}
        onDelete={onDelete} canDelete={canDelete} deletingId={deletingId} />

      <GroupSection title="Concluídos" count={concluidos.length}
        colorClass="bg-emerald-50 text-emerald-700" items={concluidos}
        today={today} in3={in3Days} onEdit={onEdit} onToggleDone={onToggleDone}
        onDelete={onDelete} canDelete={canDelete} deletingId={deletingId} defaultOpen={false} />

      <GroupSection title="Cancelados" count={cancelados.length}
        colorClass="bg-slate-100 text-slate-500" items={cancelados}
        today={today} in3={in3Days} onEdit={onEdit} onToggleDone={onToggleDone}
        onDelete={onDelete} canDelete={canDelete} deletingId={deletingId} defaultOpen={false} />
    </div>
  )
}
