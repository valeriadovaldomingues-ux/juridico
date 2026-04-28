'use client'

import { useState, useCallback, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, List, CalendarDays, AlarmClock, Search, Filter, FileUp,
  CheckCircle2, X, AlertTriangle, CalendarClock, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AgendaItem, AgendaForm, Processo, Cliente, ViewMode,
  toLocalISODate, emptyForm, getWeekStart,
} from './agenda-types'
import AgendaModal from './AgendaModal'
import ListView  from './views/ListView'
import DayView   from './views/DayView'
import WeekView  from './views/WeekView'
import MonthView from './views/MonthView'

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface Props {
  initialItems: AgendaItem[]
  processos: Processo[]
  clientes: Cliente[]
}

type BulkAction = 'delete' | 'complete' | 'vencidos'

interface ConfirmState {
  action:  BulkAction
  ids:     string[]
  message: string
}

interface RescheduleState {
  ids:  string[]
  date: string
  hora: string
}

interface ToastState {
  message: string
  ok:      boolean
}

// ── Toast ──────────────────────────────────────────────────────────────────────

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-[13px] font-semibold animate-in fade-in slide-in-from-bottom-4 duration-300',
      toast.ok
        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
        : 'bg-red-50 border-red-200 text-red-800',
    )}>
      {toast.ok
        ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
        : <AlertTriangle size={16} className="text-red-600 shrink-0" />}
      {toast.message}
      <button onClick={onClose} className="ml-1 text-current/50 hover:text-current transition-colors">
        <X size={14} />
      </button>
    </div>
  )
}

// ── Modal de confirmação ────────────────────────────────────────────────────────

function ConfirmModal({
  title, message, confirmLabel, confirmClass = 'bg-red-600 hover:bg-red-700',
  onConfirm, onCancel, loading,
}: {
  title:        string
  message:      ReactNode
  confirmLabel: string
  confirmClass?: string
  onConfirm:    () => void
  onCancel:     () => void
  loading:      boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start gap-3 p-5 border-b border-[#f3f4f6]">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-[#0f1923]">{title}</h3>
            <div className="text-[13px] text-[#6b7280] mt-1 leading-relaxed">{message}</div>
          </div>
        </div>
        <div className="flex gap-2 p-4 justify-end">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 text-[13px] text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={cn('flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white rounded-xl transition-colors disabled:opacity-50', confirmClass)}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : null}
            {loading ? 'Processando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal de remarcação ────────────────────────────────────────────────────────

function RescheduleModal({
  count, state, onChange, onConfirm, onCancel, loading,
}: {
  count:    number
  state:    RescheduleState
  onChange: (s: Partial<RescheduleState>) => void
  onConfirm:() => void
  onCancel: () => void
  loading:  boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f3f4f6]">
          <h3 className="text-[14px] font-bold text-[#0f1923] flex items-center gap-2">
            <CalendarClock size={16} className="text-blue-600" />
            Remarcar {count} {count === 1 ? 'item' : 'itens'}
          </h3>
          <button onClick={onCancel} className="text-[#9ca3af] hover:text-[#374151] transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5">
              Nova data <span className="text-red-500">*</span>
            </label>
            <input type="date" value={state.date} onChange={e => onChange({ date: e.target.value })}
              className="w-full px-3 py-2.5 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B] focus:bg-white" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5">
              Nova hora (opcional)
            </label>
            <input type="time" value={state.hora} onChange={e => onChange({ hora: e.target.value })}
              className="w-full px-3 py-2.5 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B] focus:bg-white" />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5 justify-end">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 text-[13px] text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading || !state.date}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <CalendarClock size={13} />}
            {loading ? 'Remarcando…' : 'Remarcar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── AgendaPage principal ───────────────────────────────────────────────────────

export default function AgendaPage({ initialItems, processos, clientes }: Props) {
  const supabase = createClient()

  const [items, setItems] = useState<AgendaItem[]>(initialItems)

  // ── View & nav ─────────────────────────────────────────────────────────────
  const now    = new Date()
  const [view, setView] = useState<ViewMode>('lista')
  const [dayDate, setDayDate]     = useState(toLocalISODate(now))
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(now))
  const [calYear,  setCalYear]    = useState(now.getFullYear())
  const [calMonth, setCalMonth]   = useState(now.getMonth())
  const today   = toLocalISODate(now)
  const in3Days = toLocalISODate(new Date(now.getTime() + 3  * 86400000))
  const in7Days = toLocalISODate(new Date(now.getTime() + 7  * 86400000))

  // ── Filters ────────────────────────────────────────────────────────────────
  const [filterBusca,       setFilterBusca]       = useState('')
  const [filterTipo,        setFilterTipo]        = useState('todos')
  const [filterStatus,      setFilterStatus]      = useState('pendente')
  const [filterProcesso,    setFilterProcesso]    = useState('')
  const [filterResponsavel, setFilterResponsavel] = useState('')
  const [filterDe,          setFilterDe]          = useState('')
  const [filterAte,         setFilterAte]         = useState('')
  const [showExtraFilters,  setShowExtraFilters]  = useState(false)

  // ── Modal de criação/edição ────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [form,      setForm]      = useState<AgendaForm>(emptyForm())
  const [saving,    setSaving]    = useState(false)

  // ── Seleção múltipla ───────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // ── Modais de ação em lote ─────────────────────────────────────────────────
  const [confirmState,   setConfirmState]   = useState<ConfirmState | null>(null)
  const [rescheduleState,setRescheduleState]= useState<RescheduleState | null>(null)
  const [bulkLoading,    setBulkLoading]    = useState(false)

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<ToastState | null>(null)

  function showToast(message: string, ok = true) {
    setToast({ message, ok })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = items.filter(item => {
    if (filterTipo !== 'todos' && item.tipo !== filterTipo) return false
    if (filterStatus !== 'todos' && item.status !== filterStatus) return false
    if (filterProcesso && item.processo_id !== filterProcesso) return false
    if (filterResponsavel) {
      if (!(item.responsavel ?? '').toLowerCase().includes(filterResponsavel.toLowerCase())) return false
    }
    if (filterDe  && item.data_inicio < filterDe)  return false
    if (filterAte && item.data_inicio > filterAte)  return false
    if (filterBusca) {
      const q = filterBusca.toLowerCase()
      const match = item.titulo.toLowerCase().includes(q)
        || (item.processo?.titulo ?? '').toLowerCase().includes(q)
        || (item.responsavel ?? '').toLowerCase().includes(q)
        || (item.descricao ?? '').toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  })

  const alertCount = items.filter(i => {
    if (i.status !== 'pendente') return false
    return (i.prazo_final ?? i.data_inicio) <= in3Days
  }).length

  // ── Handlers de seleção ────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll(ids: string[], select: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (select) ids.forEach(id => next.add(id))
      else        ids.forEach(id => next.delete(id))
      return next
    })
  }

  function clearSelection() { setSelectedIds(new Set()) }

  // ── Handlers de criação/edição ─────────────────────────────────────────────

  function openNew(defaults?: Partial<AgendaForm>) {
    setEditId(null); setForm(emptyForm(defaults)); setModalOpen(true)
  }

  function openEdit(item: AgendaItem) {
    setEditId(item.id)
    setForm({
      titulo:      item.titulo,         descricao:   item.descricao ?? '',
      tipo:        item.tipo,           status:      item.status,
      data_inicio: item.data_inicio,    hora_inicio: item.hora_inicio ?? '',
      data_fim:    item.data_fim ?? '',  hora_fim:    item.hora_fim ?? '',
      prazo_final: item.prazo_final ?? '', prioridade: item.prioridade,
      processo_id: item.processo_id ?? '', cliente_id: item.cliente_id ?? '',
      responsavel: item.responsavel ?? '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.titulo.trim() || !form.data_inicio) return
    setSaving(true)
    const payload = {
      titulo: form.titulo.trim(), descricao: form.descricao || null,
      tipo: form.tipo, status: form.status, data_inicio: form.data_inicio,
      hora_inicio: form.hora_inicio || null, data_fim: form.data_fim || null,
      hora_fim: form.hora_fim || null, prazo_final: form.prazo_final || null,
      prioridade: form.prioridade, processo_id: form.processo_id || null,
      cliente_id: form.cliente_id || null, responsavel: form.responsavel || null,
    }
    if (editId) {
      const proc = processos.find(p => p.id === form.processo_id)
      const cli  = clientes.find(c => c.id === form.cliente_id)
      setItems(prev => prev.map(i => i.id === editId ? {
        ...i, ...payload,
        descricao: payload.descricao ?? undefined, hora_inicio: payload.hora_inicio ?? undefined,
        data_fim: payload.data_fim ?? undefined, hora_fim: payload.hora_fim ?? undefined,
        prazo_final: payload.prazo_final ?? undefined, processo_id: payload.processo_id ?? undefined,
        cliente_id: payload.cliente_id ?? undefined, responsavel: payload.responsavel ?? undefined,
        processo: proc ? { titulo: proc.titulo } : undefined,
        cliente:  cli  ? { nome:   cli.nome   } : undefined,
      } : i))
      await supabase.from('agenda_items').update(payload).eq('id', editId)
    } else {
      const { data } = await supabase.from('agenda_items')
        .insert(payload).select('*, processo:processos(titulo), cliente:clientes(nome)').single()
      if (data) setItems(prev => [...prev, data as AgendaItem])
    }
    setSaving(false); setModalOpen(false)
  }

  async function handleDelete() {
    if (!editId) return
    const res = await fetch(`/api/agenda-items/${editId}`, { method: 'DELETE' })
    if (!res.ok) { const b = await res.json().catch(() => ({})); showToast(b.error ?? 'Erro ao excluir', false); return }
    setItems(prev => prev.filter(i => i.id !== editId))
    setSelectedIds(prev => { const n = new Set(prev); n.delete(editId!); return n })
    setModalOpen(false)
    showToast('Item excluído com sucesso')
  }

  async function handleDuplicate() {
    if (!editId) return
    const original = items.find(i => i.id === editId)
    if (!original) return
    const payload = {
      titulo: `${original.titulo} (cópia)`, descricao: original.descricao ?? null,
      tipo: original.tipo, status: 'pendente' as const,
      data_inicio: original.data_inicio, hora_inicio: original.hora_inicio ?? null,
      data_fim: original.data_fim ?? null, hora_fim: original.hora_fim ?? null,
      prazo_final: original.prazo_final ?? null, prioridade: original.prioridade,
      processo_id: original.processo_id ?? null, cliente_id: original.cliente_id ?? null,
      responsavel: original.responsavel ?? null,
    }
    setModalOpen(false)
    const { data } = await supabase.from('agenda_items')
      .insert(payload).select('*, processo:processos(titulo), cliente:clientes(nome)').single()
    if (data) setItems(prev => [...prev, data as AgendaItem])
  }

  async function handleToggleDone(item: AgendaItem) {
    const newStatus = item.status === 'concluido' ? 'pendente' : 'concluido'
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i))
    await supabase.from('agenda_items').update({ status: newStatus }).eq('id', item.id)
  }

  async function handleDragToDay(itemId: string, date: string) {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, data_inicio: date } : i))
    await supabase.from('agenda_items').update({ data_inicio: date }).eq('id', itemId)
  }

  // ── Ações rápidas por item ────────────────────────────────────────────────

  function handleQuickDelete(item: AgendaItem) {
    setConfirmState({
      action:  'delete',
      ids:     [item.id],
      message: `Deseja excluir "${item.titulo}"? Esta ação não pode ser desfeita.`,
    })
  }

  function handleQuickReschedule(item: AgendaItem) {
    setRescheduleState({ ids: [item.id], date: item.data_inicio, hora: item.hora_inicio ?? '' })
  }

  // ── Ações em lote ──────────────────────────────────────────────────────────

  function handleBulkDelete(ids: string[]) {
    setConfirmState({
      action:  'delete',
      ids,
      message: `Deseja realmente excluir ${ids.length} ${ids.length === 1 ? 'item selecionado' : 'itens selecionados'}? Esta ação não poderá ser desfeita.`,
    })
  }

  function handleBulkComplete(ids: string[]) {
    setConfirmState({
      action:  'complete',
      ids,
      message: `Marcar ${ids.length} ${ids.length === 1 ? 'item' : 'itens'} como concluído${ids.length === 1 ? '' : 's'}?`,
    })
  }

  function handleBulkReschedule(ids: string[]) {
    setRescheduleState({ ids, date: today, hora: '' })
  }

  function handleClearVencidos(ids: string[]) {
    setConfirmState({
      action:  'vencidos',
      ids,
      message: `Deseja excluir todos os ${ids.length} ${ids.length === 1 ? 'lançamento vencido' : 'lançamentos vencidos'} atualmente visíveis? Esta ação não pode ser desfeita.`,
    })
  }

  // ── Executar confirmação ───────────────────────────────────────────────────

  async function executeConfirm() {
    if (!confirmState) return
    const { action, ids } = confirmState
    setBulkLoading(true)
    try {
      if (action === 'delete' || action === 'vencidos') {
        const res = await fetch('/api/agenda-items/bulk', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', ids }),
        })
        if (!res.ok) { const b = await res.json().catch(() => ({})); showToast(b.error ?? 'Erro ao excluir', false); return }
        setItems(prev => prev.filter(i => !ids.includes(i.id)))
        setSelectedIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n })
        showToast(`${ids.length} ${ids.length === 1 ? 'item excluído' : 'itens excluídos'}`)
      } else if (action === 'complete') {
        const res = await fetch('/api/agenda-items/bulk', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'complete', ids }),
        })
        if (!res.ok) { const b = await res.json().catch(() => ({})); showToast(b.error ?? 'Erro', false); return }
        setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, status: 'concluido' } : i))
        setSelectedIds(new Set())
        showToast(`${ids.length} ${ids.length === 1 ? 'item concluído' : 'itens concluídos'}`)
      }
    } finally {
      setBulkLoading(false)
      setConfirmState(null)
    }
  }

  // ── Executar remarcação ────────────────────────────────────────────────────

  async function executeReschedule() {
    if (!rescheduleState || !rescheduleState.date) return
    const { ids, date, hora } = rescheduleState
    setBulkLoading(true)
    try {
      const res = await fetch('/api/agenda-items/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reschedule', ids, data_inicio: date, hora_inicio: hora || undefined }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); showToast(b.error ?? 'Erro ao remarcar', false); return }
      setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, data_inicio: date, hora_inicio: hora || undefined } : i))
      setSelectedIds(new Set())
      showToast(`${ids.length} ${ids.length === 1 ? 'item remarcado' : 'itens remarcados'}`)
    } finally {
      setBulkLoading(false)
      setRescheduleState(null)
    }
  }

  const closeModal = useCallback(() => setModalOpen(false), [])

  // ── Navigation ─────────────────────────────────────────────────────────────

  function shiftDay(delta: number) {
    const [y, m, d] = dayDate.split('-').map(Number)
    setDayDate(toLocalISODate(new Date(y, m - 1, d + delta)))
  }
  function shiftWeek(delta: number) {
    setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + delta * 7); return d })
  }
  function prevMonth() { calMonth === 0 ? (setCalYear(y => y - 1), setCalMonth(11)) : setCalMonth(m => m - 1) }
  function nextMonth() { calMonth === 11 ? (setCalYear(y => y + 1), setCalMonth(0)) : setCalMonth(m => m + 1) }

  function switchView(v: ViewMode) {
    setView(v)
    if (v === 'dia')    setDayDate(today)
    if (v === 'semana') setWeekStart(getWeekStart(new Date()))
    if (v === 'mes')    { setCalYear(now.getFullYear()); setCalMonth(now.getMonth()) }
    clearSelection() // limpa seleção ao trocar de view
  }

  const hasExtraFilters = filterProcesso || filterResponsavel || filterDe || filterAte

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-[#0f1923] tracking-tight">Agenda Jurídica</h1>
          <p className="text-[13px] text-[#9aabb8] mt-0.5">Compromissos, prazos e eventos do escritório</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {alertCount > 0 && (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
              <AlarmClock size={13} /> {alertCount} {alertCount === 1 ? 'alerta' : 'alertas'}
            </span>
          )}

          {/* View toggle */}
          <div className="flex bg-[#F0F6F6] rounded-xl p-1 gap-0.5">
            {([
              { v: 'lista',  icon: <List size={12} />,        label: 'Lista'  },
              { v: 'dia',    icon: <span className="text-[11px] font-bold">D</span>, label: 'Dia'   },
              { v: 'semana', icon: <span className="text-[11px] font-bold">S</span>, label: 'Sem.'  },
              { v: 'mes',    icon: <CalendarDays size={12} />, label: 'Mês'   },
            ] as const).map(({ v, icon, label }) => (
              <button key={v} onClick={() => switchView(v)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors',
                  view === v ? 'bg-white text-[#0f1923] shadow-sm' : 'text-[#7a8899] hover:text-[#0f1923]'
                )}>
                {icon} {label}
              </button>
            ))}
          </div>

          <Link href="/agenda/importar"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#D0DCDC] hover:border-[#145A5B] hover:bg-[#f5f7fa] text-[#3d4a5c] text-[13px] font-medium rounded-xl transition-colors">
            <FileUp size={14} /> Importar CSV
          </Link>

          <button
            onClick={() => openNew(view === 'dia' ? { data_inicio: dayDate } : undefined)}
            className="flex items-center gap-2 px-4 py-2 bg-[#0F3D3E] hover:bg-[#145A5B] text-white text-[13px] font-semibold rounded-xl transition-colors shadow-sm">
            <Plus size={14} /> Novo
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[#E8F0F0] shadow-sm px-5 py-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aabb8]" />
            <input
              placeholder="Buscar…"
              value={filterBusca}
              onChange={e => setFilterBusca(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[#D0DCDC] bg-[#F7F9F9] text-[13px] text-[#0f1923] placeholder:text-[#9aabb8] focus:outline-none focus:border-[#0F3D3E] focus:bg-white transition-colors"
            />
          </div>

          <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
            className="rounded-xl border border-[#D0DCDC] bg-white px-3 py-2 text-[13px] text-[#4a5a6a] focus:outline-none focus:border-[#0F3D3E] transition-colors">
            <option value="todos">Todos os tipos</option>
            <option value="tarefa">Tarefa</option>
            <option value="evento">Evento</option>
            <option value="prazo">Prazo</option>
            <option value="audiencia">Audiência</option>
          </select>

          <div className="flex bg-[#F0F6F6] rounded-xl p-1 gap-0.5">
            {[
              { v: 'pendente',  l: 'Pendentes'  },
              { v: 'concluido', l: 'Concluídos' },
              { v: 'todos',     l: 'Todos'      },
            ].map(({ v, l }) => (
              <button key={v} onClick={() => setFilterStatus(v)}
                className={cn(
                  'px-3 py-1 rounded-lg text-[12px] font-medium transition-colors',
                  filterStatus === v ? 'bg-white text-[#0f1923] shadow-sm' : 'text-[#7a8899] hover:text-[#0f1923]'
                )}>
                {l}
              </button>
            ))}
          </div>

          <button onClick={() => setShowExtraFilters(s => !s)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-medium transition-colors',
              showExtraFilters || hasExtraFilters
                ? 'border-[#0F3D3E] text-[#0F3D3E] bg-emerald-50'
                : 'border-[#D0DCDC] text-[#7a8899] hover:border-[#c8d8d8]'
            )}>
            <Filter size={12} /> Mais filtros
            {hasExtraFilters && <span className="w-1.5 h-1.5 rounded-full bg-[#0F3D3E]" />}
          </button>
        </div>

        {showExtraFilters && (
          <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-[#F0F6F6]">
            <select value={filterProcesso} onChange={e => setFilterProcesso(e.target.value)}
              className="rounded-xl border border-[#D0DCDC] bg-white px-3 py-2 text-[13px] text-[#4a5a6a] focus:outline-none focus:border-[#0F3D3E] transition-colors max-w-[220px]">
              <option value="">Todos os processos</option>
              {processos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
            </select>

            <input placeholder="Responsável…" value={filterResponsavel}
              onChange={e => setFilterResponsavel(e.target.value)}
              className="rounded-xl border border-[#D0DCDC] bg-white px-3.5 py-2 text-[13px] text-[#0f1923] placeholder:text-[#9aabb8] focus:outline-none focus:border-[#0F3D3E] transition-colors w-36" />

            <div className="flex items-center gap-2">
              <input type="date" value={filterDe} onChange={e => setFilterDe(e.target.value)}
                className="rounded-xl border border-[#D0DCDC] bg-white px-3 py-2 text-[13px] text-[#4a5a6a] focus:outline-none focus:border-[#0F3D3E] transition-colors" />
              <span className="text-[12px] text-[#9aabb8]">até</span>
              <input type="date" value={filterAte} onChange={e => setFilterAte(e.target.value)}
                className="rounded-xl border border-[#D0DCDC] bg-white px-3 py-2 text-[13px] text-[#4a5a6a] focus:outline-none focus:border-[#0F3D3E] transition-colors" />
            </div>

            {hasExtraFilters && (
              <button onClick={() => { setFilterProcesso(''); setFilterResponsavel(''); setFilterDe(''); setFilterAte('') }}
                className="text-[12px] text-red-500 hover:text-red-700 font-medium transition-colors">
                Limpar
              </button>
            )}
          </div>
        )}
      </div>

      {/* View content */}
      {view === 'lista' && (
        <ListView
          items={filtered}
          today={today} in3Days={in3Days} in7Days={in7Days}
          onEdit={openEdit} onToggleDone={handleToggleDone} onNew={() => openNew()}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleAll={toggleAll}
          onClearSelection={clearSelection}
          onBulkDelete={handleBulkDelete}
          onBulkComplete={handleBulkComplete}
          onBulkReschedule={handleBulkReschedule}
          onQuickDelete={handleQuickDelete}
          onQuickReschedule={handleQuickReschedule}
          onClearVencidos={handleClearVencidos}
        />
      )}

      {view === 'dia' && (
        <DayView
          items={filtered} date={dayDate} today={today} in3Days={in3Days}
          onPrev={() => shiftDay(-1)} onNext={() => shiftDay(1)}
          onGoToday={() => setDayDate(today)}
          onEdit={openEdit} onToggleDone={handleToggleDone}
          onNew={date => openNew({ data_inicio: date })}
        />
      )}

      {view === 'semana' && (
        <WeekView
          items={filtered} weekStart={weekStart} today={today} in3Days={in3Days}
          onPrevWeek={() => shiftWeek(-1)} onNextWeek={() => shiftWeek(1)}
          onGoToday={() => setWeekStart(getWeekStart(new Date()))}
          onEdit={openEdit} onToggleDone={handleToggleDone}
          onNew={date => openNew({ data_inicio: date })}
          onDragToDay={handleDragToDay}
        />
      )}

      {view === 'mes' && (
        <MonthView
          items={filtered} year={calYear} month={calMonth} today={today} in3Days={in3Days}
          onPrevMonth={prevMonth} onNextMonth={nextMonth}
          onGoToday={() => { setCalYear(now.getFullYear()); setCalMonth(now.getMonth()) }}
          onDayClick={date => openNew({ data_inicio: date })}
          onItemClick={openEdit} onDragToDay={handleDragToDay}
        />
      )}

      {/* Modal criação/edição */}
      {modalOpen && (
        <AgendaModal
          form={form} setForm={setForm} isEdit={!!editId}
          processos={processos} clientes={clientes}
          onSave={handleSave}
          onDelete={editId ? handleDelete : undefined}
          onDuplicate={editId ? handleDuplicate : undefined}
          onClose={closeModal}
          saving={saving}
        />
      )}

      {/* Modal confirmação em lote */}
      {confirmState && (
        <ConfirmModal
          title={
            confirmState.action === 'complete'
              ? 'Concluir itens selecionados'
              : 'Excluir itens'
          }
          message={confirmState.message}
          confirmLabel={
            confirmState.action === 'complete'
              ? `Concluir ${confirmState.ids.length}`
              : `Excluir ${confirmState.ids.length}`
          }
          confirmClass={
            confirmState.action === 'complete'
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-red-600 hover:bg-red-700'
          }
          onConfirm={executeConfirm}
          onCancel={() => setConfirmState(null)}
          loading={bulkLoading}
        />
      )}

      {/* Modal remarcação em lote */}
      {rescheduleState && (
        <RescheduleModal
          count={rescheduleState.ids.length}
          state={rescheduleState}
          onChange={s => setRescheduleState(prev => prev ? { ...prev, ...s } : null)}
          onConfirm={executeReschedule}
          onCancel={() => setRescheduleState(null)}
          loading={bulkLoading}
        />
      )}

      {/* Toast */}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
