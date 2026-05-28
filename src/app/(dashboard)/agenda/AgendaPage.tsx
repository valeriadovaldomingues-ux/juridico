'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Plus, List, CalendarDays, AlarmClock, Search, Filter, FileUp, Clock3, DollarSign, BadgeInfo } from 'lucide-react'
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
import type { AgendaTimeEntry, UserRole } from '@/types'
import {
  type AgendaTimeEntryDraft,
  buildAgendaTimeEntrySummary,
  formatCurrencyBRL,
  formatDurationMinutes,
} from '@/lib/agenda-time-entries'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initialItems: AgendaItem[]
  processos: Processo[]
  clientes: Cliente[]
  currentUserId: string
  currentUserRole: UserRole
  canDelete: boolean
  canManageTimeEntries: boolean
  canViewTimeReports: boolean
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AgendaPage({
  initialItems,
  processos,
  clientes,
  currentUserId,
  currentUserRole,
  canDelete,
  canManageTimeEntries,
  canViewTimeReports,
}: Props) {
  const supabase = createClient()

  const [items, setItems] = useState<AgendaItem[]>(initialItems)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [timeEntrySaving, setTimeEntrySaving] = useState(false)
  const [timeEntryDeletingId, setTimeEntryDeletingId] = useState<string | null>(null)

  // ── View & nav ─────────────────────────────────────────────────────────────
  const now    = new Date()
  const [view, setView] = useState<ViewMode>('lista')

  // Day view
  const [dayDate, setDayDate] = useState(toLocalISODate(now))

  // Week view
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(now))

  // Month view
  const [calYear,  setCalYear]  = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())

  // ── Date references ────────────────────────────────────────────────────────
  const today  = toLocalISODate(now)
  const in3Days = toLocalISODate(new Date(now.getTime() + 3  * 86400000))
  const in7Days = toLocalISODate(new Date(now.getTime() + 7  * 86400000))

  // ── Filters ────────────────────────────────────────────────────────────────
  const [filterBusca,      setFilterBusca]      = useState('')
  const [filterTipo,       setFilterTipo]       = useState('todos')
  const [filterStatus,     setFilterStatus]     = useState('pendente')
  const [filterProcesso,   setFilterProcesso]   = useState('')
  const [filterResponsavel,setFilterResponsavel]= useState('')
  const [filterDe,         setFilterDe]         = useState('')
  const [filterAte,        setFilterAte]        = useState('')
  const [showExtraFilters, setShowExtraFilters] = useState(false)

  // ── Modal ──────────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [form,      setForm]      = useState<AgendaForm>(emptyForm())
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(null), 3000)
    return () => window.clearTimeout(timer)
  }, [feedback])

  // ─── Filtering ─────────────────────────────────────────────────────────────

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

  const timeSummary = useMemo(() => {
    if (!canViewTimeReports) return null
    return buildAgendaTimeEntrySummary(filtered.flatMap(item => item.time_entries ?? []))
  }, [canViewTimeReports, filtered])

  // ─── Alert count ───────────────────────────────────────────────────────────
  const alertCount = items.filter(i => {
    if (i.status !== 'pendente') return false
    return (i.prazo_final ?? i.data_inicio) <= in3Days
  }).length

  const currentAgendaItem = editId ? items.find(item => item.id === editId) ?? null : null

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function openNew(defaults?: Partial<AgendaForm>) {
    setEditId(null)
    setForm(emptyForm(defaults))
    setModalOpen(true)
  }

  function openEdit(item: AgendaItem) {
    setEditId(item.id)
    setForm({
      titulo:      item.titulo,
      descricao:   item.descricao ?? '',
      tipo:        item.tipo,
      status:      item.status,
      data_inicio: item.data_inicio,
      hora_inicio: item.hora_inicio ?? '',
      data_fim:    item.data_fim ?? '',
      hora_fim:    item.hora_fim ?? '',
      prazo_final: item.prazo_final ?? '',
      prioridade:  item.prioridade,
      processo_id: item.processo_id ?? '',
      cliente_id:  item.cliente_id ?? '',
      responsavel: item.responsavel ?? '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.titulo.trim() || !form.data_inicio) return
    setSaving(true)

    const payload = {
      titulo:      form.titulo.trim(),
      descricao:   form.descricao   || null,
      tipo:        form.tipo,
      status:      form.status,
      data_inicio: form.data_inicio,
      hora_inicio: form.hora_inicio || null,
      data_fim:    form.data_fim    || null,
      hora_fim:    form.hora_fim    || null,
      prazo_final: form.prazo_final || null,
      prioridade:  form.prioridade,
      processo_id: form.processo_id || null,
      cliente_id:  form.cliente_id  || null,
      responsavel: form.responsavel || null,
    }

    if (editId) {
      // Build optimistic relations
      const proc = processos.find(p => p.id === form.processo_id)
      const cli  = clientes.find(c => c.id === form.cliente_id)

      setItems(prev => prev.map(i => i.id === editId ? {
        ...i,
        titulo:      payload.titulo,
        descricao:   payload.descricao    ?? undefined,
        tipo:        payload.tipo,
        status:      payload.status,
        data_inicio: payload.data_inicio,
        hora_inicio: payload.hora_inicio  ?? undefined,
        data_fim:    payload.data_fim     ?? undefined,
        hora_fim:    payload.hora_fim     ?? undefined,
        prazo_final: payload.prazo_final  ?? undefined,
        prioridade:  payload.prioridade,
        processo_id: payload.processo_id  ?? undefined,
        cliente_id:  payload.cliente_id   ?? undefined,
        responsavel: payload.responsavel  ?? undefined,
        processo:    proc ? { titulo: proc.titulo } : undefined,
        cliente:     cli  ? { nome:   cli.nome   } : undefined,
      } : i))
      await supabase.from('agenda_items').update(payload).eq('id', editId)
    } else {
      const { data } = await supabase
        .from('agenda_items')
        .insert(payload)
        .select('*, processo:processos(titulo), cliente:clientes(nome)')
        .single()
      if (data) setItems(prev => [...prev, data as AgendaItem])
    }

    setSaving(false)
    setModalOpen(false)
  }

  async function handleDelete(item: AgendaItem) {
    if (!canDelete) {
      setFeedback({ type: 'error', message: 'Você não tem permissão para excluir este evento.' })
      return
    }

    const ok = window.confirm('Tem certeza que deseja excluir este evento?')
    if (!ok) return

    setDeletingId(item.id)
    try {
      const res = await fetch(`/api/agenda-items/${item.id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Erro ao excluir item')

      setItems(prev => prev.filter(i => i.id !== item.id))
      if (editId === item.id) {
        setModalOpen(false)
        setEditId(null)
      }
      setFeedback({ type: 'success', message: 'Evento excluído com sucesso.' })
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message ?? 'Erro ao excluir item' })
    } finally {
      setDeletingId(null)
    }
  }

  function patchAgendaItemTimeEntries(itemId: string, updater: (entries: AgendaTimeEntry[]) => AgendaTimeEntry[]) {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      return {
        ...item,
        time_entries: updater(item.time_entries ?? []),
      }
    }))
  }

  async function handleUpsertTimeEntry(entryId: string | null, draft: AgendaTimeEntryDraft) {
    if (!draft.agenda_item_id) {
      setFeedback({ type: 'error', message: 'Evento não informado para lançar horas.' })
      return null
    }

    const url = entryId ? `/api/agenda-time-entries/${entryId}` : '/api/agenda-time-entries'
    const method = entryId ? 'PUT' : 'POST'

    setTimeEntrySaving(true)
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Erro ao salvar lançamento de horas')

      const saved = body as AgendaTimeEntry
      patchAgendaItemTimeEntries(draft.agenda_item_id, entries => {
        if (entryId) return entries.map(entry => entry.id === entryId ? saved : entry)
        return [saved, ...entries]
      })
      setFeedback({
        type: 'success',
        message: entryId ? 'Lançamento atualizado com sucesso.' : 'Lançamento criado com sucesso.',
      })
      return saved
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message ?? 'Erro ao salvar lançamento de horas' })
      return null
    } finally {
      setTimeEntrySaving(false)
    }
  }

  async function handleDeleteTimeEntry(entryId: string) {
    setTimeEntryDeletingId(entryId)
    try {
      const res = await fetch(`/api/agenda-time-entries/${entryId}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok && res.status !== 204) throw new Error(body.error ?? 'Erro ao excluir lançamento de horas')

      setItems(prev => prev.map(item => ({
        ...item,
        time_entries: (item.time_entries ?? []).filter(entry => entry.id !== entryId),
      })))
      setFeedback({ type: 'success', message: 'Lançamento de horas excluído com sucesso.' })
      return true
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message ?? 'Erro ao excluir lançamento de horas' })
      return false
    } finally {
      setTimeEntryDeletingId(null)
    }
  }

  async function handleDuplicate() {
    if (!editId) return
    const original = items.find(i => i.id === editId)
    if (!original) return

    const payload = {
      titulo:      `${original.titulo} (cópia)`,
      descricao:   original.descricao   ?? null,
      tipo:        original.tipo,
      status:      'pendente' as const,
      data_inicio: original.data_inicio,
      hora_inicio: original.hora_inicio  ?? null,
      data_fim:    original.data_fim     ?? null,
      hora_fim:    original.hora_fim     ?? null,
      prazo_final: original.prazo_final  ?? null,
      prioridade:  original.prioridade,
      processo_id: original.processo_id  ?? null,
      cliente_id:  original.cliente_id   ?? null,
      responsavel: original.responsavel  ?? null,
    }

    setModalOpen(false)
    const { data } = await supabase
      .from('agenda_items')
      .insert(payload)
      .select('*, processo:processos(titulo), cliente:clientes(nome)')
      .single()
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

  const closeModal = useCallback(() => setModalOpen(false), [])

  // ─── Day navigation ────────────────────────────────────────────────────────

  function shiftDay(delta: number) {
    const [y, m, d] = dayDate.split('-').map(Number)
    const dt = new Date(y, m - 1, d + delta)
    setDayDate(toLocalISODate(dt))
  }

  function shiftWeek(delta: number) {
    setWeekStart(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + delta * 7)
      return d
    })
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  // ─── View switch helpers ───────────────────────────────────────────────────

  function switchView(v: ViewMode) {
    setView(v)
    if (v === 'dia')    setDayDate(today)
    if (v === 'semana') setWeekStart(getWeekStart(new Date()))
    if (v === 'mes')    { setCalYear(now.getFullYear()); setCalMonth(now.getMonth()) }
  }

  const hasExtraFilters = filterProcesso || filterResponsavel || filterDe || filterAte

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 max-w-6xl">

      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 sm:px-7 sm:py-6 shadow-[0_18px_48px_rgba(13,34,53,0.06)]">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[var(--color-petrol-light)] to-transparent pointer-events-none" />
        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-copper)] mb-2">Operacional</p>
            <h1 className="font-brand text-[34px] font-semibold text-[var(--color-ink)] tracking-tight leading-none">Agenda Jurídica</h1>
            <p className="text-[13px] text-[var(--color-ink-3)] mt-2">Compromissos, prazos e eventos do escritório</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {alertCount > 0 && (
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                <AlarmClock size={13} />
                {alertCount} {alertCount === 1 ? 'alerta' : 'alertas'}
              </span>
            )}

          {/* View toggle */}
            <div className="flex bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl p-1 gap-0.5">
              {([
                { v: 'lista',  icon: <List size={12} />,        label: 'Lista'  },
                { v: 'dia',    icon: <span className="text-[11px] font-bold">D</span>, label: 'Dia'   },
                { v: 'semana', icon: <span className="text-[11px] font-bold">S</span>, label: 'Sem.'  },
                { v: 'mes',    icon: <CalendarDays size={12} />, label: 'Mês'   },
              ] as const).map(({ v, icon, label }) => (
                <button
                  key={v}
                  onClick={() => switchView(v)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors',
                    view === v ? 'bg-white text-[var(--color-ink)] shadow-sm' : 'text-[var(--color-ink-3)] hover:text-[var(--color-ink)]'
                  )}
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            <Link
              href="/agenda/importar"
              className="flex items-center gap-2 px-4 py-2 bg-white border border-[var(--color-border)] hover:border-[var(--color-copper)] hover:bg-[var(--color-surface-warm)] text-[var(--color-ink-2)] text-[13px] font-medium rounded-xl transition-colors"
            >
              <FileUp size={14} /> Importar CSV
            </Link>

            <button
              onClick={() => openNew(view === 'dia' ? { data_inicio: dayDate } : undefined)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-sidebar)] hover:bg-[var(--color-petrol)] text-white text-[13px] font-semibold rounded-xl transition-colors shadow-sm"
            >
              <Plus size={14} /> Novo
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'rounded-xl border px-4 py-3 text-[13px] font-medium shadow-sm',
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700',
          )}
        >
          {feedback.message}
        </div>
      )}

      {canViewTimeReports && timeSummary && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 shadow-[0_12px_36px_rgba(13,34,53,0.05)]">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
              <Clock3 size={12} className="text-[var(--color-copper)]" />
              Horas filtradas
            </div>
            <p className="mt-2 text-[26px] font-black leading-none text-[var(--color-ink)]">
              {formatDurationMinutes(timeSummary.totalMinutes)}
            </p>
            <p className="mt-1 text-[12px] text-[var(--color-ink-3)]">
              {timeSummary.entryCount} lançamento(s) na visão atual
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 shadow-[0_12px_36px_rgba(13,34,53,0.05)]">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
              <BadgeInfo size={12} className="text-[var(--color-copper)]" />
              Horas cobráveis
            </div>
            <p className="mt-2 text-[26px] font-black leading-none text-[var(--color-ink)]">
              {formatDurationMinutes(timeSummary.billableMinutes)}
            </p>
            <p className="mt-1 text-[12px] text-[var(--color-ink-3)]">
              {timeSummary.nonBillableMinutes > 0
                ? `${formatDurationMinutes(timeSummary.nonBillableMinutes)} não cobráveis`
                : 'Sem tempo não cobrável na visão'}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 shadow-[0_12px_36px_rgba(13,34,53,0.05)]">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
              <DollarSign size={12} className="text-[var(--color-copper)]" />
              Valor estimado
            </div>
            <p className="mt-2 text-[26px] font-black leading-none text-[var(--color-ink)]">
              {formatCurrencyBRL(timeSummary.estimatedValue)}
            </p>
            <p className="mt-1 text-[12px] text-[var(--color-ink-3)]">
              Baseado nas entradas cobráveis desta filtragem
            </p>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-[0_12px_36px_rgba(13,34,53,0.05)] px-5 py-4 space-y-3">
        {/* Row 1 — main filters */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Busca */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aabb8]" />
            <input
              placeholder="Buscar…"
              value={filterBusca}
              onChange={e => setFilterBusca(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[var(--color-border)] bg-white text-[13px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)] focus:outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/10 transition-colors"
            />
          </div>

          {/* Tipo */}
          <select
            value={filterTipo}
            onChange={e => setFilterTipo(e.target.value)}
            className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-ink-2)] focus:outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/10 transition-colors"
          >
            <option value="todos">Todos os tipos</option>
            <option value="tarefa">Tarefa</option>
            <option value="evento">Evento</option>
            <option value="prazo">Prazo</option>
            <option value="audiencia">Audiência</option>
          </select>

          {/* Status */}
          <div className="flex bg-[var(--color-surface-warm)] border border-[var(--color-border)] rounded-xl p-1 gap-0.5">
            {[
              { v: 'pendente',  l: 'Pendentes'  },
              { v: 'concluido', l: 'Concluídos' },
              { v: 'todos',     l: 'Todos'      },
            ].map(({ v, l }) => (
              <button
                key={v}
                onClick={() => setFilterStatus(v)}
                className={cn(
                  'px-3 py-1 rounded-lg text-[12px] font-medium transition-colors',
                  filterStatus === v ? 'bg-white text-[var(--color-ink)] shadow-sm' : 'text-[var(--color-ink-3)] hover:text-[var(--color-ink)]'
                )}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Toggle extra filters */}
          <button
            onClick={() => setShowExtraFilters(s => !s)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-medium transition-colors',
              showExtraFilters || hasExtraFilters
                ? 'border-[var(--color-copper)] text-[var(--color-petrol)] bg-[var(--color-petrol-light)]'
                : 'border-[var(--color-border)] text-[var(--color-ink-3)] hover:border-[var(--color-copper)]'
            )}
          >
            <Filter size={12} />
            Mais filtros
            {hasExtraFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#1D5F60]" />
            )}
          </button>
        </div>

        {/* Row 2 — extra filters */}
        {showExtraFilters && (
          <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-[var(--color-border)]">
            {/* Processo */}
            <select
              value={filterProcesso}
              onChange={e => setFilterProcesso(e.target.value)}
              className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-ink-2)] focus:outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/10 transition-colors max-w-[220px]"
            >
              <option value="">Todos os processos</option>
              {processos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
            </select>

            {/* Responsável */}
            <input
              placeholder="Responsável…"
              value={filterResponsavel}
              onChange={e => setFilterResponsavel(e.target.value)}
              className="rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2 text-[13px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)] focus:outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/10 transition-colors w-36"
            />

            {/* Período */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filterDe}
                onChange={e => setFilterDe(e.target.value)}
                className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-ink-2)] focus:outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/10 transition-colors"
              />
              <span className="text-[12px] text-[var(--color-ink-3)]">até</span>
              <input
                type="date"
                value={filterAte}
                onChange={e => setFilterAte(e.target.value)}
                className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-ink-2)] focus:outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/10 transition-colors"
              />
            </div>

            {/* Clear extras */}
            {hasExtraFilters && (
              <button
                onClick={() => { setFilterProcesso(''); setFilterResponsavel(''); setFilterDe(''); setFilterAte('') }}
                className="text-[12px] text-red-500 hover:text-red-700 font-medium transition-colors"
              >
                Limpar
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── View content ── */}
      {view === 'lista' && (
          <ListView
            items={filtered}
            today={today}
            in3Days={in3Days}
            in7Days={in7Days}
            onEdit={openEdit}
            onToggleDone={handleToggleDone}
            onNew={() => openNew()}
            onDelete={handleDelete}
            canDelete={canDelete}
            deletingId={deletingId}
          />
        )}

      {view === 'dia' && (
        <DayView
          items={filtered}
          date={dayDate}
          today={today}
          in3Days={in3Days}
          onPrev={() => shiftDay(-1)}
          onNext={() => shiftDay(1)}
          onGoToday={() => setDayDate(today)}
          onEdit={openEdit}
          onToggleDone={handleToggleDone}
          onNew={date => openNew({ data_inicio: date })}
          onDelete={handleDelete}
          canDelete={canDelete}
          deletingId={deletingId}
        />
      )}

      {view === 'semana' && (
        <WeekView
          items={filtered}
          weekStart={weekStart}
          today={today}
          in3Days={in3Days}
          onPrevWeek={() => shiftWeek(-1)}
          onNextWeek={() => shiftWeek(1)}
          onGoToday={() => setWeekStart(getWeekStart(new Date()))}
          onEdit={openEdit}
          onToggleDone={handleToggleDone}
          onNew={date => openNew({ data_inicio: date })}
          onDragToDay={handleDragToDay}
          onDelete={handleDelete}
          canDelete={canDelete}
          deletingId={deletingId}
        />
      )}

      {view === 'mes' && (
        <MonthView
          items={filtered}
          year={calYear}
          month={calMonth}
          today={today}
          in3Days={in3Days}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
          onGoToday={() => { setCalYear(now.getFullYear()); setCalMonth(now.getMonth()) }}
          onDayClick={date => openNew({ data_inicio: date })}
          onItemClick={openEdit}
          onDragToDay={handleDragToDay}
          onDelete={handleDelete}
          canDelete={canDelete}
          deletingId={deletingId}
        />
      )}

      {/* ── Modal ── */}
      {modalOpen && (
        <AgendaModal
          form={form}
          setForm={setForm}
          isEdit={!!editId}
          agendaItem={currentAgendaItem}
          processos={processos}
          clientes={clientes}
          onSave={handleSave}
          onDelete={editId ? () => {
            const current = items.find(i => i.id === editId)
            if (current) void handleDelete(current)
          } : undefined}
          onDuplicate={editId ? handleDuplicate : undefined}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          canManageTimeEntries={canManageTimeEntries}
          timeEntries={currentAgendaItem?.time_entries ?? []}
          onUpsertTimeEntry={handleUpsertTimeEntry}
          onDeleteTimeEntry={handleDeleteTimeEntry}
          timeEntrySaving={timeEntrySaving}
          timeEntryDeletingId={timeEntryDeletingId}
          onClose={closeModal}
          saving={saving}
          canDelete={canDelete}
        />
      )}
    </div>
  )
}
