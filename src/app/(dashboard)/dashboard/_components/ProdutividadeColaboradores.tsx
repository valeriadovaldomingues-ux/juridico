'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Users, ChevronUp, ChevronDown, CalendarRange } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProdutividadeRow } from '@/app/api/dashboard/produtividade/route'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Periodo = 'hoje' | 'semana' | 'mes' | 'personalizado'
type SortKey = 'nome' | 'total' | 'no_prazo' | 'adiantado' | 'atrasado'

// ─── Helpers de data ──────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

function periodoToDates(p: Periodo, customInicio: string, customFim: string): { inicio: Date; fim: Date } {
  const hoje = new Date()
  switch (p) {
    case 'hoje':
      return { inicio: startOfDay(hoje), fim: endOfDay(hoje) }
    case 'semana': {
      const s = new Date(hoje)
      s.setDate(hoje.getDate() - 6)
      return { inicio: startOfDay(s), fim: endOfDay(hoje) }
    }
    case 'mes': {
      const s = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      return { inicio: startOfDay(s), fim: endOfDay(hoje) }
    }
    case 'personalizado': {
      const i = customInicio ? new Date(customInicio + 'T00:00:00') : startOfDay(new Date())
      const f = customFim    ? new Date(customFim    + 'T23:59:59') : endOfDay(new Date())
      return { inicio: i, fim: f }
    }
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ProdutividadeColaboradores() {
  const [periodo,      setPeriodo]      = useState<Periodo>('mes')
  const [customInicio, setCustomInicio] = useState('')
  const [customFim,    setCustomFim]    = useState('')
  const [rows,         setRows]         = useState<ProdutividadeRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [erro,         setErro]         = useState('')
  const [sortKey,      setSortKey]      = useState<SortKey>('total')
  const [sortAsc,      setSortAsc]      = useState(false)

  const fetchData = useCallback(async (p: Periodo, ci: string, cf: string) => {
    const { inicio, fim } = periodoToDates(p, ci, cf)
    if (p === 'personalizado' && (!ci || !cf)) return  // aguarda preenchimento

    setLoading(true)
    setErro('')
    try {
      const params = new URLSearchParams({
        inicio: inicio.toISOString(),
        fim:    fim.toISOString(),
      })
      const res = await fetch(`/api/dashboard/produtividade?${params}`)
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        setErro(e.error ?? `Erro ${res.status}`)
        return
      }
      setRows(await res.json())
    } catch {
      setErro('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch inicial e quando período muda
  useEffect(() => {
    if (periodo !== 'personalizado') {
      fetchData(periodo, customInicio, customFim)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo])

  // Fetch quando datas customizadas estiverem preenchidas
  useEffect(() => {
    if (periodo === 'personalizado' && customInicio && customFim) {
      fetchData('personalizado', customInicio, customFim)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customInicio, customFim])

  // Ordenação
  const sorted = [...rows].sort((a, b) => {
    const va = sortKey === 'nome' ? a.nome : a[sortKey]
    const vb = sortKey === 'nome' ? b.nome : b[sortKey]
    if (va < vb) return sortAsc ? -1 : 1
    if (va > vb) return sortAsc ? 1  : -1
    return 0
  })

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(key === 'nome') }
  }

  const PERIODO_OPTS: { v: Periodo; l: string }[] = [
    { v: 'hoje',         l: 'Hoje'       },
    { v: 'semana',       l: '7 dias'     },
    { v: 'mes',          l: 'Este mês'   },
    { v: 'personalizado', l: 'Período…'  },
  ]

  const totalGeral = rows.reduce((s, r) => s + r.total, 0)

  return (
    <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm overflow-hidden">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#F0F4F4]">
        <div className="flex items-center gap-2.5">
          <Users size={14} className="text-[#9aabb8]" />
          <h2 className="text-[14px] font-semibold text-[#0f1923]">Tarefas concluídas por colaborador</h2>
          {!loading && totalGeral > 0 && (
            <span className="text-[11px] text-[#9aabb8] bg-[#F3F1EE] px-2 py-0.5 rounded-md border border-[#E2DDD8]">
              {totalGeral} concluídas
            </span>
          )}
        </div>

        {/* Filtros de período */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {PERIODO_OPTS.map(o => (
            <button
              key={o.v}
              onClick={() => setPeriodo(o.v)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors',
                periodo === o.v
                  ? 'bg-[#1D5F60] text-white'
                  : 'bg-[#F3F1EE] text-[#7a8899] hover:bg-[#E8F2F2] border border-[#E2DDD8]',
              )}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {/* Inputs de período personalizado */}
      {periodo === 'personalizado' && (
        <div className="flex items-center gap-3 px-6 py-3 bg-[#FAFBFB] border-b border-[#F0F4F4]">
          <CalendarRange size={13} className="text-[#9aabb8] flex-shrink-0" />
          <span className="text-[12px] text-[#7a8899] font-medium">De</span>
          <input
            type="date"
            value={customInicio}
            onChange={e => setCustomInicio(e.target.value)}
            className="px-3 py-1.5 text-[12px] bg-white border border-[#e5e7eb] rounded-lg outline-none focus:border-[#1D5F60] text-[#374151]"
          />
          <span className="text-[12px] text-[#7a8899] font-medium">até</span>
          <input
            type="date"
            value={customFim}
            onChange={e => setCustomFim(e.target.value)}
            className="px-3 py-1.5 text-[12px] bg-white border border-[#e5e7eb] rounded-lg outline-none focus:border-[#1D5F60] text-[#374151]"
          />
        </div>
      )}

      {/* Conteúdo */}
      {loading ? (
        <div className="flex items-center justify-center py-14 text-[#9ca3af]">
          <Loader2 size={16} className="animate-spin mr-2" />
          <span className="text-[13px]">Carregando…</span>
        </div>
      ) : erro ? (
        <p className="text-[13px] text-red-500 bg-red-50 px-6 py-4 m-4 rounded-xl">{erro}</p>
      ) : sorted.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <div className="w-12 h-12 rounded-lg bg-[#F3F1EE] flex items-center justify-center mx-auto mb-3">
            <Users size={20} className="text-[#D0DCDC]" />
          </div>
          <p className="text-[13px] text-[#9aabb8]">Nenhuma tarefa concluída no período selecionado</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#F3F1EE] border-b border-[#F0F4F4]">
                <SortTh label="Colaborador" col="nome"     current={sortKey} asc={sortAsc} onClick={toggleSort} align="left"  />
                <SortTh label="Total"       col="total"    current={sortKey} asc={sortAsc} onClick={toggleSort} align="right" />
                <SortTh label="No prazo"    col="no_prazo" current={sortKey} asc={sortAsc} onClick={toggleSort} align="right" hint="Concluído até a data-limite" />
                <SortTh label="Adiantado"   col="adiantado" current={sortKey} asc={sortAsc} onClick={toggleSort} align="right" hint="Concluído antes da data-limite" />
                <SortTh label="Atrasado"    col="atrasado" current={sortKey} asc={sortAsc} onClick={toggleSort} align="right" hint="Concluído após a data-limite" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <ProdutividadeRow key={row.profile_id} row={row} index={i} />
              ))}
            </tbody>

            {/* Rodapé de totais */}
            {sorted.length > 1 && (
              <tfoot>
                <tr className="bg-[#F3F1EE] border-t border-[#E2DDD8]">
                  <td className="px-5 py-3 text-[12px] font-bold text-[#4a5a6a]">
                    Total — {sorted.length} colaboradores
                  </td>
                  <TotalCell v={rows.reduce((s, r) => s + r.total,     0)} />
                  <TotalCell v={rows.reduce((s, r) => s + r.no_prazo,  0)} />
                  <TotalCell v={rows.reduce((s, r) => s + r.adiantado, 0)} />
                  <TotalCell v={rows.reduce((s, r) => s + r.atrasado,  0)} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SortTh({
  label, col, current, asc, onClick, align, hint,
}: {
  label:   string
  col:     SortKey
  current: SortKey
  asc:     boolean
  onClick: (k: SortKey) => void
  align:   'left' | 'right'
  hint?:   string
}) {
  const active = current === col
  return (
    <th
      className={cn(
        'px-5 py-3 font-semibold text-[11px] uppercase tracking-wide cursor-pointer select-none whitespace-nowrap transition-colors',
        align === 'right' ? 'text-right' : 'text-left',
        active ? 'text-[#0F3D3E]' : 'text-[#9aabb8] hover:text-[#4a5a6a]',
      )}
      onClick={() => onClick(col)}
      title={hint}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? asc
            ? <ChevronUp size={11} />
            : <ChevronDown size={11} />
          : <span className="w-[11px]" />
        }
      </span>
    </th>
  )
}

function ProdutividadeRow({ row, index }: { row: ProdutividadeRow; index: number }) {
  const maxPossible = row.total || 1
  const pctNoPrazo  = Math.round((row.no_prazo  / maxPossible) * 100)
  const pctAtrasado = Math.round((row.atrasado  / maxPossible) * 100)

  // Badge de performance
  const perf = row.total === 0 ? null
    : row.atrasado === 0 && row.no_prazo > 0 ? 'otimo'
    : pctAtrasado <= 20                       ? 'bom'
    : pctAtrasado <= 50                       ? 'atencao'
    : 'critico'

  const perfBadge: Record<string, string> = {
    otimo:   'bg-emerald-50 text-emerald-700 border border-emerald-100',
    bom:     'bg-blue-50   text-blue-700    border border-blue-100',
    atencao: 'bg-amber-50  text-amber-700   border border-amber-100',
    critico: 'bg-red-50    text-red-700     border border-red-100',
  }
  const perfLabel: Record<string, string> = {
    otimo: 'Ótimo', bom: 'Bom', atencao: 'Atenção', critico: 'Crítico',
  }

  return (
    <tr className={cn(
      'border-b border-[#F7F9F9] hover:bg-[#FAFBFB] transition-colors group',
      index % 2 === 0 ? '' : 'bg-[#FEFEFE]',
    )}>
      {/* Colaborador */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E8F0F0] to-[#D0DCDC] flex items-center justify-center flex-shrink-0">
            <span className="text-[12px] font-bold text-[#1D5F60]">
              {row.nome.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-medium text-[#0f1923] truncate">{row.nome}</p>
            {/* Mini barra de prazo */}
            <div className="flex items-center gap-1.5 mt-1">
              <div className="h-1.5 w-24 bg-[#F0F4F4] rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-emerald-400 rounded-full"
                  style={{ width: `${pctNoPrazo}%` }}
                />
              </div>
              <span className="text-[10px] text-[#9aabb8]">{pctNoPrazo}% no prazo</span>
            </div>
          </div>
        </div>
      </td>

      {/* Total */}
      <td className="px-5 py-3.5 text-right">
        <div className="flex items-center justify-end gap-2">
          {perf && (
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${perfBadge[perf]}`}>
              {perfLabel[perf]}
            </span>
          )}
          <span className="text-[15px] font-bold text-[#0f1923]">{row.total}</span>
        </div>
      </td>

      {/* No prazo */}
      <td className="px-5 py-3.5 text-right">
        <NumCell
          v={row.no_prazo}
          total={row.total}
          colorFull="text-emerald-700"
          colorEmpty="text-[#9aabb8]"
          bgFull="bg-emerald-50"
        />
      </td>

      {/* Adiantado */}
      <td className="px-5 py-3.5 text-right">
        <NumCell
          v={row.adiantado}
          total={row.total}
          colorFull="text-blue-700"
          colorEmpty="text-[#9aabb8]"
          bgFull="bg-blue-50"
        />
      </td>

      {/* Atrasado */}
      <td className="px-5 py-3.5 text-right">
        <NumCell
          v={row.atrasado}
          total={row.total}
          colorFull="text-red-700"
          colorEmpty="text-[#9aabb8]"
          bgFull="bg-red-50"
          invert
        />
      </td>
    </tr>
  )
}

function NumCell({
  v, total, colorFull, colorEmpty, bgFull, invert = false,
}: {
  v:          number
  total:      number
  colorFull:  string
  colorEmpty: string
  bgFull:     string
  invert?:    boolean
}) {
  const pct = total > 0 ? Math.round((v / total) * 100) : 0
  if (v === 0) return <span className={`font-medium ${colorEmpty}`}>—</span>

  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <span className={cn(
        'text-[13px] font-bold px-1.5 py-0.5 rounded-md',
        invert && v > 0 ? `${bgFull} ${colorFull}` : `${bgFull} ${colorFull}`,
      )}>
        {v}
      </span>
      <span className="text-[10px] text-[#9aabb8]">{pct}%</span>
    </div>
  )
}

function TotalCell({ v }: { v: number }) {
  return (
    <td className="px-5 py-3 text-right text-[12px] font-bold text-[#4a5a6a]">
      {v > 0 ? v : '—'}
    </td>
  )
}
