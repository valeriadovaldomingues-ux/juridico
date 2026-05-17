'use client'

import { useState, useMemo } from 'react'
import { Plus, TrendingUp, Search, ChevronRight, AlertCircle } from 'lucide-react'
import type { Lead, LeadOrigem, LeadStatus } from '@/types/comercial'
import { STATUS_LABEL, ORIGEM_LABEL, FUNIL_COLUNAS } from '@/types/comercial'
import FunilBoard from './FunilBoard'
import LeadModal from './LeadModal'

interface Profile { id: string; nome: string; cor_kanban: string | null; role: string }

interface Props {
  initialLeads: Lead[]
  profiles: Profile[]
  currentUserId: string
  reunioesPendentes: number
}

type Tab = 'funil' | 'lista' | 'relatorios'

// ─── Painel executivo — barra de métricas horizontal ─────────────────────────
function PainelExecutivo({ stats, reunioesPendentes }: {
  stats: ReturnType<typeof calcStats>
  reunioesPendentes: number
}) {
  const items = [
    {
      label:  'Pipeline ativo',
      value:  stats.pipeline > 0
        ? stats.pipeline.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
        : '—',
      sub:    `${stats.ativos} lead${stats.ativos !== 1 ? 's' : ''} em andamento`,
      color:  '#145A5B',
      border: 'border-l-[#145A5B]',
    },
    {
      label:  'Taxa de conversão',
      value:  `${stats.taxa}%`,
      sub:    `${stats.fechados} fechados / ${stats.total} total`,
      color:  stats.taxa >= 30 ? '#059669' : stats.taxa >= 15 ? '#d97706' : '#64748b',
      border: stats.taxa >= 30 ? 'border-l-emerald-600' : stats.taxa >= 15 ? 'border-l-amber-500' : 'border-l-slate-400',
    },
    {
      label:  'Reuniões agendadas',
      value:  String(stats.reunioes + reunioesPendentes),
      sub:    'leads + agenda',
      color:  '#7c3aed',
      border: 'border-l-violet-600',
    },
    {
      label:  'Propostas pendentes',
      value:  String(stats.propostas),
      sub:    'aguardando resposta',
      color:  '#4f46e5',
      border: 'border-l-indigo-600',
    },
    {
      label:  'Receita gerada',
      value:  stats.receita > 0
        ? stats.receita.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
        : '—',
      sub:    'leads convertidos',
      color:  '#059669',
      border: 'border-l-emerald-600',
    },
    {
      label:  'Tempo médio',
      value:  stats.tempoMedio != null ? `${stats.tempoMedio} dias` : '—',
      sub:    'do lead ao fechamento',
      color:  '#64748b',
      border: 'border-l-slate-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-0 bg-white rounded-lg border border-zinc-100 shadow-sm overflow-hidden">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`px-5 py-4 border-l-2 ${item.border} ${i > 0 ? 'border-t border-t-zinc-50 sm:border-t-0 sm:border-l-2' : ''}`}
        >
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">{item.label}</p>
          <p className="text-xl font-bold" style={{ color: item.color }}>{item.value}</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">{item.sub}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcStats(leads: Lead[]) {
  const total     = leads.length
  const ativos    = leads.filter(l => !['fechado', 'perdido'].includes(l.status)).length
  const fechados  = leads.filter(l => l.status === 'fechado').length
  const perdidos  = leads.filter(l => l.status === 'perdido').length
  const reunioes  = leads.filter(l => l.status === 'reuniao_agendada').length
  const propostas = leads.filter(l => l.status === 'proposta_enviada').length
  const taxa      = total > 0 ? Math.round((fechados / total) * 100) : 0
  const pipeline  = leads.filter(l => !['fechado', 'perdido'].includes(l.status)).reduce((s, l) => s + (l.valor_estimado ?? 0), 0)
  const receita   = leads.filter(l => l.status === 'fechado').reduce((s, l) => s + (l.valor_estimado ?? 0), 0)
  const parados   = leads.filter(l =>
    !['fechado', 'perdido'].includes(l.status) &&
    Math.floor((Date.now() - new Date(l.updated_at).getTime()) / 86_400_000) >= 7
  ).length
  const fechadosComData = leads.filter(l => l.status === 'fechado' && l.convertido_em)
  const tempoMedio = fechadosComData.length > 0
    ? Math.round(fechadosComData.reduce((s, l) => s + (new Date(l.convertido_em!).getTime() - new Date(l.created_at).getTime()) / 86_400_000, 0) / fechadosComData.length)
    : null
  return { total, ativos, fechados, perdidos, reunioes, propostas, taxa, pipeline, receita, tempoMedio, parados }
}

function diasAberto(createdAt: string) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
}

function diasSemMovimento(updatedAt: string) {
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000)
}

// ─── StatusPill ───────────────────────────────────────────────────────────────
const STATUS_PILL: Record<LeadStatus, string> = {
  novo_lead:          'bg-slate-100 text-slate-600',
  contato_inicial:    'bg-blue-50 text-blue-700',
  aguardando_retorno: 'bg-amber-50 text-amber-700',
  reuniao_agendada:   'bg-violet-50 text-violet-700',
  proposta_enviada:   'bg-indigo-50 text-indigo-700',
  negociacao:         'bg-orange-50 text-orange-700',
  fechado:            'bg-emerald-50 text-emerald-700',
  perdido:            'bg-red-50 text-red-600',
}

// ─── ComercialPage ────────────────────────────────────────────────────────────
export default function ComercialPage({ initialLeads, profiles, currentUserId, reunioesPendentes }: Props) {
  const [leads, setLeads]           = useState<Lead[]>(initialLeads)
  const [tab, setTab]               = useState<Tab>('funil')
  const [search, setSearch]         = useState('')
  const [filterOrigem, setFilterOrigem] = useState<LeadOrigem | ''>('')
  const [filterResp, setFilterResp] = useState('')
  const [filterStatus, setFilterStatus] = useState<LeadStatus | ''>('')
  const [modalLead, setModalLead]   = useState<Lead | null | undefined>(undefined)

  const stats = useMemo(() => calcStats(leads), [leads])

  const leadsFiltrados = useMemo(() => leads.filter(l => {
    if (search) {
      const q = search.toLowerCase()
      if (!l.nome.toLowerCase().includes(q) && !(l.telefone ?? '').includes(q) && !(l.email ?? '').toLowerCase().includes(q)) return false
    }
    if (filterOrigem && l.origem !== filterOrigem) return false
    if (filterResp   && l.responsavel_id !== filterResp) return false
    if (filterStatus && l.status !== filterStatus) return false
    return true
  }), [leads, search, filterOrigem, filterResp, filterStatus])

  function handleLeadUpdate(id: string, updates: Partial<Lead>) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))
  }
  function handleSaved(updated: Lead) {
    setLeads(prev => {
      const idx = prev.findIndex(l => l.id === updated.id)
      return idx === -1 ? [updated, ...prev] : prev.map(l => l.id === updated.id ? updated : l)
    })
  }
  function handleDeleted(id: string) {
    setLeads(prev => prev.filter(l => l.id !== id))
  }

  const tabs: [Tab, string][] = [['funil', 'Funil'], ['lista', 'Lista'], ['relatorios', 'Relatórios']]

  return (
    <div className="flex flex-col gap-5 max-w-[1400px]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Comercial</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Captação · Atendimento · Conversão</p>
        </div>
        <div className="flex items-center gap-3">
          {stats.parados > 0 && (
            <button
              onClick={() => { setTab('lista'); setFilterStatus('aguardando_retorno') }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              <AlertCircle size={13} />
              {stats.parados} lead{stats.parados !== 1 ? 's' : ''} parado{stats.parados !== 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={() => setModalLead(null)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#145A5B] text-white text-sm font-semibold hover:bg-[#0f4344] transition-colors shadow-sm"
          >
            <Plus size={15} />Novo Lead
          </button>
        </div>
      </div>

      {/* ── Painel executivo ── */}
      <PainelExecutivo stats={stats} reunioesPendentes={reunioesPendentes} />

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 bg-zinc-100 rounded-xl p-1 self-start">
        {tabs.map(([t, l]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {l}
            {t === 'lista' && leads.length > 0 && (
              <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                tab === t ? 'bg-zinc-100 text-zinc-500' : 'bg-zinc-200 text-zinc-400'
              }`}>
                {leads.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Funil ── */}
      {tab === 'funil' && (
        <FunilBoard leads={leads} onLeadUpdate={handleLeadUpdate} onOpen={l => setModalLead(l)} />
      )}

      {/* ── Tab: Lista ── */}
      {tab === 'lista' && (
        <div className="space-y-3">
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Nome, telefone ou e-mail…"
                className="pl-8 pr-3 py-2 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1D5F60]/25 w-52 bg-white"
              />
            </div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as LeadStatus | '')}
              className="border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none bg-white text-zinc-600"
            >
              <option value="">Todos os estágios</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select
              value={filterOrigem}
              onChange={e => setFilterOrigem(e.target.value as LeadOrigem | '')}
              className="border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none bg-white text-zinc-600"
            >
              <option value="">Todas as origens</option>
              {Object.entries(ORIGEM_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select
              value={filterResp}
              onChange={e => setFilterResp(e.target.value)}
              className="border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none bg-white text-zinc-600"
            >
              <option value="">Todos os responsáveis</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            {(search || filterOrigem || filterResp || filterStatus) && (
              <button
                onClick={() => { setSearch(''); setFilterOrigem(''); setFilterResp(''); setFilterStatus('') }}
                className="text-xs text-zinc-400 hover:text-zinc-600 underline"
              >
                Limpar
              </button>
            )}
            <span className="ml-auto text-xs text-zinc-400">
              {leadsFiltrados.length} de {leads.length}
            </span>
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-lg border border-zinc-100 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/80">
                  {['Lead', 'Estágio', 'Área / Origem', 'Valor Est.', 'Responsável', 'Em aberto', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leadsFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-zinc-400 text-sm">
                      Nenhum lead encontrado
                    </td>
                  </tr>
                ) : leadsFiltrados.map(l => {
                  const diasAbto   = diasAberto(l.created_at)
                  const diasSemMov = diasSemMovimento(l.updated_at)
                  const parado     = !['fechado', 'perdido'].includes(l.status) && diasSemMov >= 7

                  return (
                    <tr
                      key={l.id}
                      onClick={() => setModalLead(l)}
                      className="border-b border-zinc-50 hover:bg-zinc-50/80 cursor-pointer transition-colors group"
                    >
                      {/* Lead */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ backgroundColor: l.responsavel?.cor_kanban ?? '#145A5B' }}
                          >
                            {l.nome.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-zinc-900 truncate">{l.nome}</p>
                            <p className="text-xs text-zinc-400 truncate">{l.telefone || l.email || '—'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Estágio */}
                      <td className="px-4 py-3.5">
                        <span className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${STATUS_PILL[l.status]}`}>
                          {STATUS_LABEL[l.status]}
                        </span>
                      </td>

                      {/* Área / Origem */}
                      <td className="px-4 py-3.5">
                        <p className="text-xs text-zinc-700">{l.area_interesse || '—'}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{ORIGEM_LABEL[l.origem]}</p>
                      </td>

                      {/* Valor */}
                      <td className="px-4 py-3.5">
                        <span className={`text-sm font-bold ${l.valor_estimado ? 'text-zinc-800' : 'text-zinc-300'}`}>
                          {l.valor_estimado
                            ? l.valor_estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
                            : '—'}
                        </span>
                      </td>

                      {/* Responsável */}
                      <td className="px-4 py-3.5 text-xs text-zinc-500">
                        {l.responsavel?.nome ?? '—'}
                      </td>

                      {/* Dias em aberto */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-xs font-medium ${diasAbto > 30 ? 'text-red-600' : diasAbto > 14 ? 'text-amber-600' : 'text-zinc-500'}`}>
                            {diasAbto}d aberto
                          </span>
                          {parado && (
                            <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                              <AlertCircle size={9} />{diasSemMov}d sem mov.
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Ação */}
                      <td className="px-3 py-3.5">
                        <ChevronRight size={14} className="text-zinc-300 group-hover:text-zinc-500 transition-colors" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Relatórios ── */}
      {tab === 'relatorios' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Leads por origem */}
          <div className="bg-white rounded-lg border border-zinc-100 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Leads por Origem</h3>
            <div className="space-y-3">
              {Object.entries(ORIGEM_LABEL).map(([origem, label]) => {
                const count    = leads.filter(l => l.origem === origem).length
                if (count === 0) return null
                const fechados = leads.filter(l => l.origem === origem && l.status === 'fechado').length
                const pct      = Math.round((count / leads.length) * 100)
                return (
                  <div key={origem}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-700 font-medium">{label}</span>
                      <span className="text-zinc-400">{count} leads · {fechados} fechados</span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#145A5B] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              {leads.length === 0 && <p className="text-sm text-zinc-400">Sem dados ainda.</p>}
            </div>
          </div>

          {/* Funil visual */}
          <div className="bg-white rounded-lg border border-zinc-100 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Distribuição no Funil</h3>
            <div className="space-y-2.5">
              {FUNIL_COLUNAS.map(col => {
                const colLeads = leads.filter(l => l.status === col.status)
                const count    = colLeads.length
                const valor    = colLeads.reduce((s, l) => s + (l.valor_estimado ?? 0), 0)
                const pct      = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0
                const accent   = col.status === 'fechado' ? '#059669' : col.status === 'perdido' ? '#ef4444' : '#145A5B'
                return (
                  <div key={col.status} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500 w-[140px] shrink-0 truncate">{col.label}</span>
                    <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: accent }} />
                    </div>
                    <span className="text-xs font-semibold text-zinc-700 w-5 text-right shrink-0">{count}</span>
                    {valor > 0 && (
                      <span className="text-xs text-zinc-500 w-24 text-right shrink-0">
                        {valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Desempenho por responsável */}
          <div className="bg-white rounded-lg border border-zinc-100 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Desempenho por Responsável</h3>
            <div className="space-y-1">
              {profiles.map(p => {
                const meus     = leads.filter(l => l.responsavel_id === p.id)
                const ativos   = meus.filter(l => !['fechado','perdido'].includes(l.status)).length
                const fechados = meus.filter(l => l.status === 'fechado').length
                const perdidos = meus.filter(l => l.status === 'perdido').length
                if (!ativos && !fechados && !perdidos) return null
                const total    = ativos + fechados + perdidos
                const taxa     = total > 0 ? Math.round((fechados / total) * 100) : 0
                const pipeline = meus.filter(l => !['fechado','perdido'].includes(l.status)).reduce((s, l) => s + (l.valor_estimado ?? 0), 0)
                return (
                  <div key={p.id} className="flex items-center gap-3 py-2.5 border-b border-zinc-50 last:border-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ backgroundColor: p.cor_kanban ?? '#145A5B' }}
                    >
                      {p.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-800 truncate">{p.nome}</p>
                      <p className="text-[11px] text-zinc-400">
                        {ativos} ativos · {fechados} fechados · {perdidos} perdidos
                        {pipeline > 0 && ` · ${pipeline.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} pipeline`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${taxa >= 30 ? 'text-emerald-600' : taxa >= 15 ? 'text-amber-600' : 'text-zinc-400'}`}>{taxa}%</p>
                      <p className="text-[10px] text-zinc-400">conversão</p>
                    </div>
                  </div>
                )
              })}
              {profiles.every(p => !leads.some(l => l.responsavel_id === p.id)) && (
                <p className="text-sm text-zinc-400">Nenhum lead atribuído ainda.</p>
              )}
            </div>
          </div>

          {/* Resumo executivo */}
          <div className="bg-white rounded-lg border border-zinc-100 p-5 shadow-sm space-y-5">
            <div>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Resumo de Conversão</h3>
              {[
                { label: 'Total de leads',             v: stats.total,     c: 'text-zinc-800 font-semibold' },
                { label: 'Leads ativos',               v: stats.ativos,    c: 'text-blue-700 font-semibold' },
                { label: 'Reuniões agendadas',         v: stats.reunioes,  c: 'text-violet-700 font-semibold' },
                { label: 'Propostas enviadas',         v: stats.propostas, c: 'text-indigo-700 font-semibold' },
                { label: 'Convertidos em clientes',    v: stats.fechados,  c: 'text-emerald-700 font-semibold' },
                { label: 'Perdidos',                   v: stats.perdidos,  c: 'text-red-600 font-semibold' },
                { label: 'Taxa de conversão',          v: `${stats.taxa}%`, c: 'text-[#1D5F60] font-bold text-base' },
                { label: 'Tempo médio até fechamento', v: stats.tempoMedio != null ? `${stats.tempoMedio} dias` : '—', c: 'text-zinc-600 font-semibold' },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center py-2 border-b border-zinc-50">
                  <span className="text-xs text-zinc-500">{item.label}</span>
                  <span className={`text-sm ${item.c}`}>{item.v}</span>
                </div>
              ))}
            </div>

            <div>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Receita</h3>
              {[
                { label: 'Pipeline ativo',      v: stats.pipeline, c: 'text-indigo-700' },
                { label: 'Receita convertida',  v: stats.receita,  c: 'text-emerald-700' },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center py-2 border-b border-zinc-50">
                  <span className="text-xs text-zinc-500">{item.label}</span>
                  <span className={`text-sm font-bold ${item.c}`}>
                    {item.v > 0 ? item.v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Fechamentos do mês */}
          <div className="bg-white rounded-lg border border-zinc-100 p-5 shadow-sm md:col-span-2">
            <div className="flex items-baseline justify-between mb-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Fechamentos — {new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
              </h3>
              <span className="text-xs text-zinc-400">clique para abrir</span>
            </div>
            {(() => {
              const inicioMes    = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
              const fechadosMes  = leads.filter(l => l.status === 'fechado' && l.convertido_em && l.convertido_em >= inicioMes)
              const receitaMes   = fechadosMes.reduce((s, l) => s + (l.valor_estimado ?? 0), 0)

              if (fechadosMes.length === 0) {
                return <p className="text-sm text-zinc-400">Nenhum fechamento registrado neste mês.</p>
              }

              return (
                <div>
                  <div className="flex gap-6 mb-4">
                    <div>
                      <p className="text-2xl font-bold text-emerald-700">{fechadosMes.length}</p>
                      <p className="text-xs text-zinc-400">fechamento{fechadosMes.length !== 1 ? 's' : ''}</p>
                    </div>
                    {receitaMes > 0 && (
                      <div>
                        <p className="text-2xl font-bold text-emerald-700">
                          {receitaMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-xs text-zinc-400">receita gerada</p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {fechadosMes.map(l => (
                      <button
                        key={l.id}
                        onClick={() => setModalLead(l)}
                        className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100 hover:border-emerald-300 transition-colors text-left"
                      >
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">{l.nome}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">{l.area_interesse || ORIGEM_LABEL[l.origem]}</p>
                        </div>
                        {l.valor_estimado && (
                          <p className="text-sm font-bold text-emerald-700 shrink-0 ml-2">
                            {l.valor_estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── Modal ── */}
      {modalLead !== undefined && (
        <LeadModal
          lead={modalLead}
          profiles={profiles}
          currentUserId={currentUserId}
          onClose={() => setModalLead(undefined)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
