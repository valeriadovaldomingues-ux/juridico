'use client'

import { useState } from 'react'
import { Plus, CalendarDays, ChevronRight, Trash2, CheckCheck, CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AgendaItem } from '../agenda-types'
import ItemRow from './ItemRow'

// ── GroupSection ───────────────────────────────────────────────────────────────

function GroupSection({
  title, count, colorClass, items, today, in3,
  onEdit, onToggleDone, defaultOpen = true,
  // Seleção
  selectedIds, onToggleSelect, onToggleAll,
  // Ações rápidas
  onQuickDelete, onQuickReschedule,
  // Botão de grupo especial
  extraAction,
}: {
  title: string; count: number; colorClass: string
  items: AgendaItem[]; today: string; in3: string
  onEdit: (i: AgendaItem) => void
  onToggleDone: (i: AgendaItem) => void
  defaultOpen?: boolean
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleAll: (ids: string[], select: boolean) => void
  onQuickDelete: (item: AgendaItem) => void
  onQuickReschedule: (item: AgendaItem) => void
  extraAction?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (items.length === 0) return null

  const ids          = items.map(i => i.id)
  const allSelected  = ids.every(id => selectedIds.has(id))
  const someSelected = ids.some(id => selectedIds.has(id))

  function handleGroupCheck(e: React.MouseEvent) {
    e.stopPropagation()
    onToggleAll(ids, !allSelected)
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E8F0F0] shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-5 py-3.5 border-b border-[#F0F6F6] hover:bg-[#f9fafb] transition-colors"
      >
        {/* Checkbox de grupo */}
        <div
          onClick={handleGroupCheck}
          className={cn(
            'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
            allSelected  ? 'bg-[#145A5B] border-[#145A5B]' :
            someSelected ? 'bg-[#145A5B]/30 border-[#145A5B]' :
                           'border-[#c8d8d8] hover:border-[#145A5B]',
          )}
        >
          {allSelected && (
            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
              <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {someSelected && !allSelected && (
            <div className="w-2 h-0.5 bg-white rounded" />
          )}
        </div>

        <h2 className="text-[13px] font-semibold text-[#0f1923] flex-1 text-left">{title}</h2>
        <span className={cn('text-[11px] font-semibold px-2.5 py-0.5 rounded-full', colorClass)}>{count}</span>
        {extraAction && <div onClick={e => e.stopPropagation()}>{extraAction}</div>}
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
              checked={selectedIds.has(item.id)}
              onCheck={(id, checked) => onToggleSelect(id)}
              onQuickDelete={() => onQuickDelete(item)}
              onQuickReschedule={() => onQuickReschedule(item)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  items:        AgendaItem[]
  today:        string
  in3Days:      string
  in7Days:      string
  onEdit:       (item: AgendaItem) => void
  onToggleDone: (item: AgendaItem) => void
  onNew:        () => void
  // Seleção e ações em lote (passadas do AgendaPage)
  selectedIds:       Set<string>
  onToggleSelect:    (id: string) => void
  onToggleAll:       (ids: string[], select: boolean) => void
  onClearSelection:  () => void
  onBulkDelete:      (ids: string[]) => void
  onBulkComplete:    (ids: string[]) => void
  onBulkReschedule:  (ids: string[]) => void
  onQuickDelete:     (item: AgendaItem) => void
  onQuickReschedule: (item: AgendaItem) => void
  onClearVencidos:   (ids: string[]) => void
}

// ── ListView ───────────────────────────────────────────────────────────────────

export default function ListView({
  items, today, in3Days, in7Days, onEdit, onToggleDone, onNew,
  selectedIds, onToggleSelect, onToggleAll, onClearSelection,
  onBulkDelete, onBulkComplete, onBulkReschedule,
  onQuickDelete, onQuickReschedule, onClearVencidos,
}: Props) {
  const pendentes  = items.filter(i => i.status === 'pendente')
  const vencidos   = pendentes.filter(i => (i.prazo_final ?? i.data_inicio) < today)
  const deHoje     = pendentes.filter(i => i.data_inicio === today && !vencidos.includes(i))
  const estaSemana = pendentes.filter(i => i.data_inicio > today && i.data_inicio <= in7Days)
  const proximos   = pendentes.filter(i => i.data_inicio > in7Days)
  const concluidos = items.filter(i => i.status === 'concluido')
  const cancelados = items.filter(i => i.status === 'cancelado')

  const selectedCount = selectedIds.size
  const selectedArr   = [...selectedIds]

  const allVisibleIds = items.map(i => i.id)
  const allSelected   = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.has(id))

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E8F0F0] shadow-sm p-12 text-center">
        <CalendarDays size={32} className="text-[#c8d8d8] mx-auto mb-3" />
        <p className="text-[14px] font-medium text-[#7a8899]">Nenhum item encontrado</p>
        <p className="text-[12px] text-[#9aabb8] mt-1">Ajuste os filtros ou crie um novo compromisso.</p>
        <button
          onClick={onNew}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#0F3D3E] text-white text-[13px] font-semibold rounded-xl hover:bg-[#145A5B] transition-colors"
        >
          <Plus size={13} /> Criar item
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">

      {/* ── Barra de ações em lote (aparece quando há seleção) ─────────────────── */}
      {selectedCount > 0 && (
        <div className="sticky top-2 z-20 flex items-center gap-2 px-4 py-3 bg-[#0F3D3E] rounded-2xl shadow-lg border border-[#145A5B] flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Selecionar todos */}
            <button
              onClick={() => allSelected ? onClearSelection() : onToggleAll(allVisibleIds, true)}
              className="w-5 h-5 rounded border-2 border-white/50 flex items-center justify-center transition-colors hover:border-white"
            >
              {allSelected && (
                <svg width="9" height="7" viewBox="0 0 8 6" fill="none">
                  <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
            <span className="text-[13px] font-semibold text-white">
              {selectedCount} {selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}
            </span>
          </div>

          {/* Ações em lote */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onBulkComplete(selectedArr)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold rounded-xl transition-colors"
            >
              <CheckCheck size={13} /> Concluir
            </button>
            <button
              onClick={() => onBulkReschedule(selectedArr)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold rounded-xl transition-colors"
            >
              <CalendarClock size={13} /> Remarcar
            </button>
            <button
              onClick={() => onBulkDelete(selectedArr)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[12px] font-semibold rounded-xl transition-colors"
            >
              <Trash2 size={13} /> Excluir
            </button>
            <button
              onClick={onClearSelection}
              className="px-3 py-1.5 text-white/70 hover:text-white text-[12px] font-medium rounded-xl hover:bg-white/10 transition-colors"
            >
              Limpar seleção
            </button>
          </div>
        </div>
      )}

      {/* ── Grupos ─────────────────────────────────────────────────────────────── */}

      <GroupSection
        title="Vencidos" count={vencidos.length}
        colorClass="bg-red-50 text-red-600"
        items={vencidos} today={today} in3={in3Days}
        onEdit={onEdit} onToggleDone={onToggleDone}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        onToggleAll={onToggleAll}
        onQuickDelete={onQuickDelete}
        onQuickReschedule={onQuickReschedule}
        extraAction={vencidos.length > 0 ? (
          <button
            onClick={() => onClearVencidos(vencidos.map(v => v.id))}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-red-600 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap"
            title="Excluir ou concluir todos os vencidos"
          >
            <Trash2 size={10} /> Limpar vencidos
          </button>
        ) : undefined}
      />

      <GroupSection
        title="Hoje" count={deHoje.length}
        colorClass="bg-amber-50 text-amber-700"
        items={deHoje} today={today} in3={in3Days}
        onEdit={onEdit} onToggleDone={onToggleDone}
        selectedIds={selectedIds} onToggleSelect={onToggleSelect}
        onToggleAll={onToggleAll} onQuickDelete={onQuickDelete}
        onQuickReschedule={onQuickReschedule}
      />

      <GroupSection
        title="Esta semana" count={estaSemana.length}
        colorClass="bg-blue-50 text-blue-600"
        items={estaSemana} today={today} in3={in3Days}
        onEdit={onEdit} onToggleDone={onToggleDone}
        selectedIds={selectedIds} onToggleSelect={onToggleSelect}
        onToggleAll={onToggleAll} onQuickDelete={onQuickDelete}
        onQuickReschedule={onQuickReschedule}
      />

      <GroupSection
        title="Próximos" count={proximos.length}
        colorClass="bg-[#E8F0F0] text-[#4a5a6a]"
        items={proximos} today={today} in3={in3Days}
        onEdit={onEdit} onToggleDone={onToggleDone}
        selectedIds={selectedIds} onToggleSelect={onToggleSelect}
        onToggleAll={onToggleAll} onQuickDelete={onQuickDelete}
        onQuickReschedule={onQuickReschedule}
      />

      <GroupSection
        title="Concluídos" count={concluidos.length}
        colorClass="bg-emerald-50 text-emerald-700"
        items={concluidos} today={today} in3={in3Days}
        onEdit={onEdit} onToggleDone={onToggleDone}
        selectedIds={selectedIds} onToggleSelect={onToggleSelect}
        onToggleAll={onToggleAll} onQuickDelete={onQuickDelete}
        onQuickReschedule={onQuickReschedule}
        defaultOpen={false}
      />

      <GroupSection
        title="Cancelados" count={cancelados.length}
        colorClass="bg-slate-100 text-slate-500"
        items={cancelados} today={today} in3={in3Days}
        onEdit={onEdit} onToggleDone={onToggleDone}
        selectedIds={selectedIds} onToggleSelect={onToggleSelect}
        onToggleAll={onToggleAll} onQuickDelete={onQuickDelete}
        onQuickReschedule={onQuickReschedule}
        defaultOpen={false}
      />
    </div>
  )
}
