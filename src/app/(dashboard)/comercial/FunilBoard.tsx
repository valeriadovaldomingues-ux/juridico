'use client'

import { useState, useRef } from 'react'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, useDroppable,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AlertCircle, Clock } from 'lucide-react'
import type { Lead, LeadStatus } from '@/types/comercial'
import { FUNIL_COLUNAS, ORIGEM_LABEL } from '@/types/comercial'

// ─── Paleta por estágio ───────────────────────────────────────────────────────
const STAGE_PALETTE: Record<LeadStatus, { accent: string; bg: string; headerBg: string; text: string }> = {
  novo_lead:          { accent: '#94a3b8', bg: '#f8fafc', headerBg: '#f1f5f9', text: '#475569' },
  contato_inicial:    { accent: '#3b82f6', bg: '#eff6ff', headerBg: '#dbeafe', text: '#1d4ed8' },
  aguardando_retorno: { accent: '#f59e0b', bg: '#fffbeb', headerBg: '#fef3c7', text: '#b45309' },
  reuniao_agendada:   { accent: '#8b5cf6', bg: '#f5f3ff', headerBg: '#ede9fe', text: '#6d28d9' },
  proposta_enviada:   { accent: '#6366f1', bg: '#eef2ff', headerBg: '#e0e7ff', text: '#4338ca' },
  negociacao:         { accent: '#f97316', bg: '#fff7ed', headerBg: '#ffedd5', text: '#c2410c' },
  fechado:            { accent: '#059669', bg: '#ecfdf5', headerBg: '#d1fae5', text: '#047857' },
  perdido:            { accent: '#ef4444', bg: '#fef2f2', headerBg: '#fee2e2', text: '#b91c1c' },
}

function diasDesdeAtualizacao(updatedAt: string): number {
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000)
}

// ─── Badge de dias parado ─────────────────────────────────────────────────────
function DiasParadoBadge({ dias }: { dias: number }) {
  if (dias < 5) return null
  const urgente = dias >= 14
  const aviso   = dias >= 7
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
        urgente ? 'bg-red-100 text-red-700' : aviso ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-500'
      }`}
    >
      {urgente ? <AlertCircle size={9} /> : <Clock size={9} />}
      {dias}d
    </span>
  )
}

// ─── MiniCard para DragOverlay ────────────────────────────────────────────────
function MiniCard({ lead }: { lead: Lead }) {
  const palette = STAGE_PALETTE[lead.status]
  return (
    <div
      className="rounded-xl shadow-2xl w-[236px] overflow-hidden"
      style={{ borderLeft: `3px solid ${palette.accent}`, background: '#fff' }}
    >
      <div className="px-3.5 py-3">
        <p className="text-sm font-semibold text-zinc-900 truncate">{lead.nome}</p>
        {lead.valor_estimado && (
          <p className="text-xs font-bold mt-1" style={{ color: palette.accent }}>
            {lead.valor_estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── LeadCard ─────────────────────────────────────────────────────────────────
function LeadCard({ lead, onOpen, paletteAccent }: { lead: Lead; onOpen: (l: Lead) => void; paletteAccent: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.25 : 1,
  }

  const dias = diasDesdeAtualizacao(lead.updated_at)
  const responsavelNome = lead.responsavel?.nome ?? null
  const responsavelCor  = lead.responsavel?.cor_kanban ?? '#145A5B'

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderLeft: `3px solid ${paletteAccent}` }}
      {...attributes}
      onClick={() => onOpen(lead)}
      className="group bg-white rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.07)] hover:shadow-[0_3px_12px_rgba(0,0,0,0.11)] cursor-pointer transition-all duration-150 overflow-hidden"
    >
      {/* Drag handle strip */}
      <div className="px-3 pt-3 pb-2.5">
        {/* Linha superior: área + dias parado */}
        <div className="flex items-center justify-between mb-1.5 min-h-[18px]">
          {lead.area_interesse ? (
            <span className="text-[10px] font-medium text-zinc-500 bg-zinc-50 border border-zinc-100 px-1.5 py-0.5 rounded-md truncate max-w-[130px]">
              {lead.area_interesse}
            </span>
          ) : (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
              style={{ color: paletteAccent, backgroundColor: `${paletteAccent}15` }}
            >
              {ORIGEM_LABEL[lead.origem]}
            </span>
          )}
          <DiasParadoBadge dias={dias} />
        </div>

        {/* Nome */}
        <p className="text-[13px] font-semibold text-zinc-900 leading-snug line-clamp-2">
          {lead.nome}
        </p>

        {/* Contato */}
        {(lead.telefone || lead.email) && (
          <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
            {lead.telefone || lead.email}
          </p>
        )}

        {/* Rodapé: valor + avatar */}
        <div className="flex items-center justify-between mt-2.5">
          {lead.valor_estimado ? (
            <span className="text-[12px] font-bold" style={{ color: paletteAccent }}>
              {lead.valor_estimado.toLocaleString('pt-BR', {
                style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
              })}
            </span>
          ) : (
            <span className="text-[11px] text-zinc-300">Sem valor</span>
          )}

          {responsavelNome && (
            <div className="flex items-center gap-1.5">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-1 ring-white"
                style={{ backgroundColor: responsavelCor }}
                title={responsavelNome}
              >
                {responsavelNome.charAt(0).toUpperCase()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grip handle — visível apenas no hover */}
      <button
        {...listeners}
        onClick={e => e.stopPropagation()}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-zinc-500 cursor-grab transition-opacity"
        style={{ position: 'absolute' }}
        aria-label="Arrastar"
      >
        {/* Grip dots */}
        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
          <circle cx="2.5" cy="2.5" r="1.5"/><circle cx="7.5" cy="2.5" r="1.5"/>
          <circle cx="2.5" cy="7" r="1.5"/><circle cx="7.5" cy="7" r="1.5"/>
          <circle cx="2.5" cy="11.5" r="1.5"/><circle cx="7.5" cy="11.5" r="1.5"/>
        </svg>
      </button>
    </div>
  )
}

// ─── Coluna droppable ─────────────────────────────────────────────────────────
function FunilColuna({
  status, label, leads, onOpen, terminal,
}: {
  status: LeadStatus
  label: string
  leads: Lead[]
  onOpen: (l: Lead) => void
  terminal: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const palette     = STAGE_PALETTE[status]
  const totalValor  = leads.reduce((s, l) => s + (l.valor_estimado ?? 0), 0)
  const leadsPrados = leads.filter(l => diasDesdeAtualizacao(l.updated_at) >= 7).length

  return (
    <div className="flex-shrink-0 w-[248px] flex flex-col">
      {/* Header */}
      <div
        className="rounded-t-2xl px-4 py-3"
        style={{ backgroundColor: palette.headerBg }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: palette.text }}>
            {label}
          </span>
          <span
            className="text-[11px] font-bold w-6 h-6 rounded-full flex items-center justify-center text-white"
            style={{ backgroundColor: palette.accent }}
          >
            {leads.length}
          </span>
        </div>
        {/* Valor total do estágio */}
        {totalValor > 0 ? (
          <p className="text-[11px] font-semibold mt-1" style={{ color: palette.accent }}>
            {totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
          </p>
        ) : (
          <p className="text-[11px] text-zinc-400 mt-1 h-4" />
        )}
        {/* Alerta leads parados */}
        {leadsPrados > 0 && !terminal && (
          <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-0.5">
            <AlertCircle size={9} />
            {leadsPrados} {leadsPrados === 1 ? 'parado' : 'parados'} &gt;7d
          </p>
        )}
      </div>

      {/* Body droppable */}
      <div
        ref={setNodeRef}
        className="relative flex-1 min-h-[160px] rounded-b-2xl p-2 space-y-2 transition-all duration-150"
        style={{
          backgroundColor: isOver ? `${palette.accent}10` : palette.bg,
          boxShadow: isOver ? `inset 0 0 0 2px ${palette.accent}40` : `inset 0 0 0 1px ${palette.accent}20`,
        }}
      >
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(l => (
            <LeadCard key={l.id} lead={l} onOpen={onOpen} paletteAccent={palette.accent} />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <div
            className="flex items-center justify-center h-20 rounded-xl border-2 border-dashed"
            style={{ borderColor: `${palette.accent}30` }}
          >
            <span className="text-[11px]" style={{ color: `${palette.accent}60` }}>
              {terminal ? (isOver ? 'Solte aqui' : label) : 'Arraste aqui'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── FunilBoard ───────────────────────────────────────────────────────────────
interface Props {
  leads: Lead[]
  onLeadUpdate: (id: string, updates: Partial<Lead>) => void
  onOpen: (lead: Lead) => void
}

export default function FunilBoard({ leads, onLeadUpdate, onOpen }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const activeLead = activeId ? leads.find(l => l.id === activeId) : null

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over) return

    const destStatus = over.id as LeadStatus
    if (!FUNIL_COLUNAS.find(c => c.status === destStatus)) return

    const lead = leads.find(l => l.id === active.id)
    if (!lead || lead.status === destStatus) return

    onLeadUpdate(lead.id, { status: destStatus })

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      fetch(`/api/comercial/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: destStatus }),
      }).catch(() => onLeadUpdate(lead.id, { status: lead.status }))
    }, 300)
  }

  // Totais para a barra de progresso do funil
  const totalAtivos = leads.filter(l => !['fechado', 'perdido'].includes(l.status)).length

  return (
    <div className="space-y-4">
      {/* Mini barra de progresso do funil */}
      {totalAtivos > 0 && (
        <div className="flex items-center gap-1 h-1.5 rounded-full overflow-hidden bg-zinc-100">
          {FUNIL_COLUNAS.filter(c => !c.terminal).map(col => {
            const count = leads.filter(l => l.status === col.status).length
            const pct   = totalAtivos > 0 ? (count / totalAtivos) * 100 : 0
            if (pct === 0) return null
            return (
              <div
                key={col.status}
                className="h-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: STAGE_PALETTE[col.status].accent }}
                title={`${col.label}: ${count}`}
              />
            )
          })}
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 pt-1 px-0.5 min-h-[540px]">
          {FUNIL_COLUNAS.map(col => (
            <FunilColuna
              key={col.status}
              status={col.status}
              label={col.label}
              terminal={col.terminal}
              leads={leads.filter(l => l.status === col.status)}
              onOpen={onOpen}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 160, easing: 'ease' }}>
          {activeLead ? <MiniCard lead={activeLead} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
