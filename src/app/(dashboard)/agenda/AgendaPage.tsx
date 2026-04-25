'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Plus, List, CalendarDays, AlarmClock, Search, Filter, FileUp } from 'lucide-react'
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initialItems: AgendaItem[]
  processos: Processo[]
  clientes: Cliente[]
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AgendaPage({ initialItems, processos, clientes }: Props) {
  const supabase = createClient()

  const [items, setItems] = useState<AgendaItem[]>(initialItems)

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

  // ─── Alert count ───────────────────────────────────────────────────────────
  const alertCount = items.filter(i => {
    if (i.status !== 'pendente') return false
    return (i.prazo_final ?? i.data_inicio) <= in3Days
  }).length

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

  async function handleDelete() {
    if (!editId) return
    const res = await fetch(`/api/agenda-items/${editId}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(body.error ?? 'Erro ao excluir item')
      return
    }
    setItems(prev => prev.filter(i => i.id !== editId))
    setModalOpen(false)
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-[#0f1923] tracking-tight">Agenda Jurídica</h1>
          <p className="text-[13px] text-[#9aabb8] mt-0.5">Compromissos, prazos e eventos do escritório</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {alertCount > 0 && (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
              <AlarmClock size={13} />
              {alertCount} {alertCount === 1 ? 'alerta' : 'alertas'}
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
              <button
                key={v}
                onClick={() => switchView(v)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors',
                  view === v ? 'bg-white text-[#0f1923] shadow-sm' : 'text-[#7a8899] hover:text-[#0f1923]'
                )}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          <Link
            href="/agenda/importar"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#D0DCDC] hover:border-[#145A5B] hover:bg-[#f5f7fa] text-[#3d4a5c] text-[13px] font-medium rounded-xl transition-colors"
          >
            <FileUp size={14} /> Importar CSV
          </Link>

          <button
            onClick={() => openNew(view === 'dia' ? { data_inicio: dayDate } : undefined)}
            className="flex items-center gap-2 px-4 py-2 bg-[#0F3D3E] hover:bg-[#145A5B] text-white text-[13px] font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Plus size={14} /> Novo
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-[#E8F0F0] shadow-sm px-5 py-4 space-y-3">
        {/* Row 1 — main filters */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Busca */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aabb8]" />
            <input
              placeholder="Buscar…"
              value={filterBusca}
              onChange={e => setFilterBusca(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[#D0DCDC] bg-[#F7F9F9] text-[13px] text-[#0f1923] placeholder:text-[#9aabb8] focus:outline-none focus:border-[#0F3D3E] focus:bg-white transition-colors"
            />
          </div>

          {/* Tipo */}
          <select
            value={filterTipo}
            onChange={e => setFilterTipo(e.target.value)}
            className="rounded-xl border border-[#D0DCDC] bg-white px-3 py-2 text-[13px] text-[#4a5a6a] focus:outline-none focus:border-[#0F3D3E] transition-colors"
          >
            <option value="todos">Todos os tipos</option>
            <option value="tarefa">Tarefa</option>
            <option value="evento">Evento</option>
            <option value="prazo">Prazo</option>
            <option value="audiencia">Audiência</option>
          </select>

          {/* Status */}
          <div className="flex bg-[#F0F6F6] rounded-xl p-1 gap-0.5">
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
                  filterStatus === v ? 'bg-white text-[#0f1923] shadow-sm' : 'text-[#7a8899] hover:text-[#0f1923]'
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
                ? 'border-[#0F3D3E] text-[#0F3D3E] bg-emerald-50'
                : 'border-[#D0DCDC] text-[#7a8899] hover:border-[#c8d8d8]'
            )}
          >
            <Filter size={12} />
            Mais filtros
            {hasExtraFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#0F3D3E]" />
            )}
          </button>
        </div>

        {/* Row 2 — extra filters */}
        {showExtraFilters && (
          <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-[#F0F6F6]">
            {/* Processo */}
            <select
              value={filterProcesso}
              onChange={e => setFilterProcesso(e.target.value)}
              className="rounded-xl border border-[#D0DCDC] bg-white px-3 py-2 text-[13px] text-[#4a5a6a] focus:outline-none focus:border-[#0F3D3E] transition-colors max-w-[220px]"
            >
              <option value="">Todos os processos</option>
              {processos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
            </select>

            {/* Responsável */}
            <input
              placeholder="Responsável…"
              value={filterResponsavel}
              onChange={e => setFilterResponsavel(e.target.value)}
              className="rounded-xl border border-[#D0DCDC] bg-white px-3.5 py-2 text-[13px] text-[#0f1923] placeholder:text-[#9aabb8] focus:outline-none focus:border-[#0F3D3E] transition-colors w-36"
            />

            {/* Período */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filterDe}
                onChange={e => setFilterDe(e.target.value)}
                className="rounded-xl border border-[#D0DCDC] bg-white px-3 py-2 text-[13px] text-[#4a5a6a] focus:outline-none focus:border-[#0F3D3E] transition-colors"
              />
              <span className="text-[12px] text-[#9aabb8]">até</span>
              <input
                type="date"
                value={filterAte}
                onChange={e => setFilterAte(e.target.value)}
                className="rounded-xl border border-[#D0DCDC] bg-white px-3 py-2 text-[13px] text-[#4a5a6a] focus:outline-none focus:border-[#0F3D3E] transition-colors"
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
        />
      )}

      {/* ── Modal ── */}
      {modalOpen && (
        <AgendaModal
          form={form}
          setForm={setForm}
          isEdit={!!editId}
          processos={processos}
          clientes={clientes}
          onSave={handleSave}
          onDelete={editId ? handleDelete : undefined}
          onDuplicate={editId ? handleDuplicate : undefined}
          onClose={closeModal}
          saving={saving}
        />
      )}
    </div>
  )
}
