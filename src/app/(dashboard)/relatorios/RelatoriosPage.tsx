'use client'

import { useState, useMemo } from 'react'
import {
  Scale, Clock, Newspaper, Users, DollarSign, BarChart3,
  Download, AlertCircle, CheckCircle2, TrendingUp, TrendingDown, ArrowUpRight,
  Building2,
} from 'lucide-react'
import Link from 'next/link'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type { UserRole } from '@/types'
import ClienteBuscaInput from '@/components/relatorios/ClienteBuscaInput'
import RelatorioCliente from '@/components/relatorios/RelatorioCliente'
import type { ClienteBuscaResult } from '@/app/api/clientes/busca/route'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Processo {
  id:                      string
  status:                  string
  area_direito:            string
  created_at:              string
  advogado_responsavel_id: string | null
  cliente:                 { nome: string } | null
  titulo:                  string
  numero_processo:         string | null
}

interface AgendaItem {
  id:          string
  titulo:      string
  tipo:        string
  status:      string
  data_inicio: string
  prazo_final: string | null
  prioridade:  string
  processo_id: string | null
  processo:    { titulo: string; numero_processo: string | null } | null
}

interface Publicacao {
  id:              string
  numero_processo: string | null
  tribunal:        string | null
  data_publicacao: string | null
  tipo_publicacao: string
  created_at:      string
}

interface KanbanTask {
  id:         string
  titulo:     string
  status:     string
  tipo:       string
  created_at: string
}

interface ProfileItem { id: string; nome: string; role: string }

interface Lancamento {
  tipo:      string
  valor:     number
  status:    string
  vencimento:string
}

interface Props {
  processos:   Processo[]
  agendaItems: AgendaItem[]
  publicacoes: Publicacao[]
  kanbanTasks: KanbanTask[]
  profiles:    ProfileItem[]
  lancamentos: Lancamento[] | null
  role:        UserRole
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABEL:  Record<string, string> = { ativo: 'Ativo', suspenso: 'Suspenso', arquivado: 'Arquivado', encerrado: 'Encerrado' }
const STATUS_COLOR:  Record<string, string> = { ativo: 'bg-emerald-400', suspenso: 'bg-amber-400', arquivado: 'bg-slate-400', encerrado: 'bg-blue-400' }
const STATUS_BADGE:  Record<string, string> = { ativo: 'bg-emerald-50 text-emerald-700', suspenso: 'bg-amber-50 text-amber-700', arquivado: 'bg-slate-50 text-slate-600', encerrado: 'bg-blue-50 text-blue-700' }
const AREA_LABEL:    Record<string, string> = { civil: 'Cível', trabalhista: 'Trabalhista', criminal: 'Criminal', tributario: 'Tributário', previdenciario: 'Previdenciário', administrativo: 'Administrativo', familia: 'Família', empresarial: 'Empresarial', outro: 'Outro' }
const AREA_COLOR:    Record<string, string> = { civil: 'bg-blue-400', trabalhista: 'bg-violet-400', criminal: 'bg-rose-400', tributario: 'bg-amber-400', previdenciario: 'bg-teal-400', administrativo: 'bg-indigo-400', familia: 'bg-pink-400', empresarial: 'bg-sky-400', outro: 'bg-slate-400' }
const PRIOR_COLOR:   Record<string, string> = { alta: 'text-red-600', media: 'text-amber-600', baixa: 'text-green-600' }
const TIPO_PUB:      Record<string, string> = { intimacao: 'Intimação', publicacao: 'Publicação', despacho: 'Despacho', sentenca: 'Sentença', acordao: 'Acórdão', outro: 'Outro' }

function filtrarPorPeriodo(dateStr: string, periodo: string): boolean {
  const hoje = new Date()
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00')
  switch (periodo) {
    case 'este-mes':    return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear()
    case 'trimestre':   return d >= new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1)
    case 'ano':         return d.getFullYear() === hoje.getFullYear()
    default:            return true
  }
}

function downloadCSV(dados: any[], campos: { key: string; label: string }[], nome: string) {
  const header = campos.map(c => `"${c.label}"`).join(',')
  const rows = dados.map(d =>
    campos.map(c => {
      const v = c.key.split('.').reduce((o: any, k) => o?.[k], d) ?? ''
      return `"${String(v).replace(/"/g, '""')}"`
    }).join(',')
  )
  const csv = '\uFEFF' + [header, ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = nome; document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

type Aba = 'processos' | 'prazos' | 'publicacoes' | 'produtividade' | 'financeiro' | 'cliente'

const ABAS: { id: Aba; label: string; icon: React.ElementType; roles?: UserRole[] }[] = [
  { id: 'processos',    label: 'Processos',    icon: Scale      },
  { id: 'prazos',       label: 'Prazos',       icon: Clock      },
  { id: 'publicacoes',  label: 'Publicações',  icon: Newspaper  },
  { id: 'produtividade',label: 'Produtividade',icon: Users      },
  { id: 'financeiro',   label: 'Financeiro',   icon: DollarSign, roles: ['gerente', 'socio'] },
  { id: 'cliente',      label: 'Por Cliente',  icon: Building2  },
]

// ─── Componente ──────────────────────────────────────────────────────────────

export default function RelatoriosPage({ processos, agendaItems, publicacoes, kanbanTasks, profiles, lancamentos, role }: Props) {
  const hoje = new Date().toISOString().slice(0, 10)
  const verFinanceiro = ['gerente', 'socio'].includes(role)

  const [aba,            setAba]            = useState<Aba>('processos')
  const [periodo,        setPeriodo]        = useState('todos')
  const [areaFiltro,     setAreaFiltro]     = useState('')
  const [responsavelFiltro, setResponsavelFiltro] = useState('')

  // ── Aba Cliente ─────────────────────────────────────────────────────────────
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteBuscaResult | null>(null)

  // ── Processos filtrados ─────────────────────────────────────────────────────

  const processosFiltrados = useMemo(() => {
    return processos.filter(p => {
      if (!filtrarPorPeriodo(p.created_at, periodo)) return false
      if (areaFiltro && p.area_direito !== areaFiltro) return false
      if (responsavelFiltro && p.advogado_responsavel_id !== responsavelFiltro) return false
      return true
    })
  }, [processos, periodo, areaFiltro, responsavelFiltro])

  // ── Agrupamentos ────────────────────────────────────────────────────────────

  const porStatus = useMemo(() => {
    const c: Record<string, number> = {}
    processosFiltrados.forEach(p => { c[p.status] = (c[p.status] ?? 0) + 1 })
    return Object.entries(c).sort((a, b) => b[1] - a[1])
  }, [processosFiltrados])

  const porArea = useMemo(() => {
    const c: Record<string, number> = {}
    processosFiltrados.forEach(p => { c[p.area_direito] = (c[p.area_direito] ?? 0) + 1 })
    return Object.entries(c).sort((a, b) => b[1] - a[1])
  }, [processosFiltrados])

  const porResponsavel = useMemo(() => {
    const c: Record<string, { nome: string; count: number }> = {}
    processosFiltrados.forEach(p => {
      const prof = profiles.find(pr => pr.id === p.advogado_responsavel_id)
      const key  = p.advogado_responsavel_id ?? '__sem_resp__'
      const nome = prof?.nome ?? 'Sem responsável'
      c[key] = { nome, count: (c[key]?.count ?? 0) + 1 }
    })
    return Object.values(c).sort((a, b) => b.count - a.count)
  }, [processosFiltrados, profiles])

  // ── Prazos ──────────────────────────────────────────────────────────────────

  const { vencidos: prazosVencidos, proximos: prazosProximos } = useMemo(() => {
    const items = agendaItems.filter(i => i.status === 'pendente')
    const dataRef = (i: AgendaItem) => i.prazo_final ?? i.data_inicio
    const vencidos = items.filter(i => dataRef(i) < hoje).sort((a, b) => dataRef(a).localeCompare(dataRef(b)))
    const proximos = items.filter(i => dataRef(i) >= hoje).sort((a, b) => dataRef(a).localeCompare(dataRef(b))).slice(0, 30)
    return { vencidos, proximos }
  }, [agendaItems, hoje])

  // ── Produtividade ───────────────────────────────────────────────────────────

  const produtividade = useMemo(() => {
    return profiles
      .filter(p => ['advogado', 'gerente', 'socio'].includes(p.role))
      .map(p => ({
        id:        p.id,
        nome:      p.nome,
        role:      p.role,
        processos: processos.filter(pr => pr.advogado_responsavel_id === p.id).length,
        ativos:    processos.filter(pr => pr.advogado_responsavel_id === p.id && pr.status === 'ativo').length,
        kanban:    kanbanTasks.filter(k => k.status === 'concluido').length, // global (sem FK por usuário)
      }))
      .sort((a, b) => b.processos - a.processos)
  }, [profiles, processos, kanbanTasks])

  // ── Financeiro ──────────────────────────────────────────────────────────────

  const fin = useMemo(() => {
    if (!lancamentos) return null
    const recebido = lancamentos.filter(l => l.tipo === 'receita' && l.status === 'pago').reduce((s, l) => s + l.valor, 0)
    const despPago = lancamentos.filter(l => l.tipo === 'despesa' && l.status === 'pago').reduce((s, l) => s + l.valor, 0)
    const aReceber = lancamentos.filter(l => l.tipo === 'receita' && l.status === 'pendente').reduce((s, l) => s + l.valor, 0)
    const vencidos = lancamentos.filter(l => l.status === 'vencido').reduce((s, l) => s + l.valor, 0)
    return { recebido, despPago, aReceber, vencidos, saldo: recebido - despPago }
  }, [lancamentos])

  const maxStatus = Math.max(...porStatus.map(([, n]) => n), 1)
  const maxArea   = Math.max(...porArea.map(([, n]) => n), 1)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-6xl">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight flex items-center gap-2">
            <BarChart3 size={20} className="text-[#1D5F60]" />
            Relatórios
          </h1>
          <p className="text-[13px] text-[#7a8899] mt-0.5">Análises estratégicas e exportação de dados</p>
        </div>
      </div>

      {/* Filtros globais */}
      <div className="bg-white rounded-lg border border-[#E2DDD8] px-5 py-3.5 flex items-center gap-3 flex-wrap shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <span className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider shrink-0">Filtros</span>
        <SelectFiltro value={periodo} onChange={setPeriodo} options={[
          { value: 'todos',    label: 'Todo o período'   },
          { value: 'este-mes', label: 'Este mês'         },
          { value: 'trimestre',label: 'Últimos 3 meses'  },
          { value: 'ano',      label: 'Este ano'         },
        ]} />
        <SelectFiltro value={areaFiltro} onChange={setAreaFiltro} options={[
          { value: '', label: 'Todas as áreas' },
          ...Object.entries(AREA_LABEL).map(([v, l]) => ({ value: v, label: l })),
        ]} />
        <SelectFiltro value={responsavelFiltro} onChange={setResponsavelFiltro} options={[
          { value: '', label: 'Todos os responsáveis' },
          ...profiles.filter(p => ['advogado','gerente','socio'].includes(p.role)).map(p => ({ value: p.id, label: p.nome })),
        ]} />
        <span className="ml-auto text-[11px] text-[#9ca3af]">{processosFiltrados.length} processos</span>
      </div>

      {/* Abas */}
      <div className="bg-white rounded-lg border border-[#E2DDD8] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="flex border-b border-[#f3f4f6] overflow-x-auto">
          {ABAS.filter(a => !a.roles || a.roles.includes(role)).map(a => {
            const Icon  = a.icon
            const ativo = aba === a.id
            return (
              <button key={a.id} onClick={() => setAba(a.id)}
                className={cn(
                  'flex items-center gap-1.5 px-5 py-3.5 text-[13px] font-medium transition-all border-b-2 -mb-px shrink-0',
                  ativo ? 'border-[#145A5B] text-[#1D5F60] bg-[#f0f7f7]' : 'border-transparent text-[#7a8899] hover:text-[#374151] hover:bg-[#f9fafb]',
                )}
              >
                <Icon size={14} /> {a.label}
              </button>
            )
          })}
        </div>

        {/* ── Aba Processos ───────────────────────────────────────────────── */}
        {aba === 'processos' && (
          <div className="p-6 space-y-6">
            {/* Resumo numérico */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Total',     val: processosFiltrados.length,                               cor: 'text-[#0f1923]' },
                { label: 'Ativos',    val: processosFiltrados.filter(p => p.status === 'ativo').length,     cor: 'text-emerald-600' },
                { label: 'Suspensos', val: processosFiltrados.filter(p => p.status === 'suspenso').length,  cor: 'text-amber-600'   },
                { label: 'Encerrados',val: processosFiltrados.filter(p => p.status === 'encerrado').length, cor: 'text-blue-600'    },
              ].map(m => (
                <div key={m.label} className="bg-[#f9fafb] rounded-xl p-4 border border-[#f3f4f6] text-center">
                  <p className={cn('text-[28px] font-bold tabular-nums', m.cor)}>{m.val}</p>
                  <p className="text-[11px] text-[#9ca3af] mt-1">{m.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Por Status */}
              <div>
                <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">Por Status</p>
                <div className="space-y-3">
                  {porStatus.map(([status, count]) => (
                    <div key={status}>
                      <div className="flex justify-between text-[12px] mb-1">
                        <span className={cn('px-2 py-0.5 rounded-full font-semibold text-[10px]', STATUS_BADGE[status] ?? 'bg-slate-50 text-slate-600')}>{STATUS_LABEL[status] ?? status}</span>
                        <span className="font-bold text-[#0f1923]">{count}</span>
                      </div>
                      <div className="h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', STATUS_COLOR[status] ?? 'bg-slate-400')} style={{ width: `${Math.round((count / maxStatus) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Por Área */}
              <div>
                <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">Por Área do Direito</p>
                <div className="space-y-3">
                  {porArea.map(([area, count]) => (
                    <div key={area}>
                      <div className="flex justify-between text-[12px] mb-1">
                        <span className="text-[#4a5a6a] font-medium">{AREA_LABEL[area] ?? area}</span>
                        <span className="font-bold text-[#0f1923]">{count}</span>
                      </div>
                      <div className="h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', AREA_COLOR[area] ?? 'bg-slate-400')} style={{ width: `${Math.round((count / maxArea) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Por Responsável */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">Por Responsável</p>
                <button
                  onClick={() => downloadCSV(
                    porResponsavel,
                    [{ key: 'nome', label: 'Responsável' }, { key: 'count', label: 'Processos' }],
                    'processos-por-responsavel.csv',
                  )}
                  className="flex items-center gap-1.5 text-[11px] text-[#9ca3af] hover:text-[#374151] transition-colors"
                >
                  <Download size={12} /> CSV
                </button>
              </div>
              <div className="rounded-xl border border-[#f3f4f6] overflow-hidden">
                <table className="w-full">
                  <thead><tr className="bg-[#f9fafb] border-b border-[#f3f4f6]">
                    <th className="text-left text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Responsável</th>
                    <th className="text-right text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Total</th>
                  </tr></thead>
                  <tbody>
                    {porResponsavel.map(r => (
                      <tr key={r.nome} className="border-b border-[#f9fafb] last:border-0">
                        <td className="px-4 py-3 text-[13px] text-[#374151]">{r.nome}</td>
                        <td className="px-4 py-3 text-right text-[13px] font-bold text-[#0f1923]">{r.count}</td>
                      </tr>
                    ))}
                    {porResponsavel.length === 0 && (
                      <tr><td colSpan={2} className="px-4 py-8 text-center text-[12px] text-[#9ca3af]">Sem dados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CSV export */}
            <div className="flex justify-end">
              <button
                onClick={() => downloadCSV(
                  processosFiltrados.map(p => ({
                    titulo:      p.titulo,
                    numero:      p.numero_processo ?? '',
                    status:      STATUS_LABEL[p.status] ?? p.status,
                    area:        AREA_LABEL[p.area_direito] ?? p.area_direito,
                    cliente:     p.cliente?.nome ?? '',
                    responsavel: profiles.find(pr => pr.id === p.advogado_responsavel_id)?.nome ?? '',
                    created_at:  p.created_at.slice(0, 10),
                  })),
                  [
                    { key: 'titulo',      label: 'Título'       },
                    { key: 'numero',      label: 'Número'       },
                    { key: 'status',      label: 'Status'       },
                    { key: 'area',        label: 'Área'         },
                    { key: 'cliente',     label: 'Cliente'      },
                    { key: 'responsavel', label: 'Responsável'  },
                    { key: 'created_at',  label: 'Criado em'    },
                  ],
                  'processos.csv',
                )}
                className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-[#374151] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors"
              >
                <Download size={14} /> Exportar lista completa (CSV)
              </button>
            </div>
          </div>
        )}

        {/* ── Aba Prazos ──────────────────────────────────────────────────── */}
        {aba === 'prazos' && (
          <div className="p-6 space-y-6">
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-red-50 rounded-xl p-4 border border-red-100 text-center">
                <p className="text-[28px] font-bold text-red-700 tabular-nums">{prazosVencidos.length}</p>
                <p className="text-[11px] text-red-500 mt-1">Vencidos</p>
              </div>
              <div className="bg-[#f9fafb] rounded-xl p-4 border border-[#f3f4f6] text-center">
                <p className="text-[28px] font-bold text-[#0f1923] tabular-nums">{prazosProximos.length}</p>
                <p className="text-[11px] text-[#9ca3af] mt-1">Próximos</p>
              </div>
              <div className="bg-[#e6f4ee] rounded-xl p-4 border border-[#b8dfc9] text-center">
                <p className="text-[28px] font-bold text-[#1a7a45] tabular-nums">
                  {agendaItems.filter(i => i.status === 'concluido').length}
                </p>
                <p className="text-[11px] text-[#1a7a45] mt-1">Concluídos</p>
              </div>
            </div>

            {/* Vencidos */}
            {prazosVencidos.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle size={12} /> Prazos Vencidos ({prazosVencidos.length})
                  </p>
                  <button
                    onClick={() => downloadCSV(prazosVencidos.map(i => ({
                      titulo: i.titulo, tipo: i.tipo, data: i.prazo_final ?? i.data_inicio, prioridade: i.prioridade, processo: i.processo?.titulo ?? '',
                    })), [
                      { key: 'titulo', label: 'Título' }, { key: 'tipo', label: 'Tipo' },
                      { key: 'data', label: 'Data' }, { key: 'prioridade', label: 'Prioridade' }, { key: 'processo', label: 'Processo' },
                    ], 'prazos-vencidos.csv')}
                    className="flex items-center gap-1.5 text-[11px] text-[#9ca3af] hover:text-[#374151] transition-colors"
                  >
                    <Download size={12} /> CSV
                  </button>
                </div>
                <div className="rounded-xl border border-red-100 overflow-hidden divide-y divide-red-50">
                  {prazosVencidos.slice(0, 20).map(i => {
                    const data = i.prazo_final ?? i.data_inicio
                    const diasAtras = Math.round((new Date().getTime() - new Date(data + 'T12:00:00').getTime()) / 86_400_000)
                    return (
                      <div key={i.id} className="flex items-center gap-3 px-4 py-3 bg-red-50/50">
                        <div className="w-1.5 h-10 rounded-full bg-red-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-red-800">{i.titulo}</p>
                          {i.processo && <p className="text-[11px] text-red-400 truncate">{i.processo.titulo}</p>}
                        </div>
                        <span className={cn('text-[11px] font-semibold shrink-0', PRIOR_COLOR[i.prioridade] ?? 'text-slate-600')}>
                          {i.prioridade}
                        </span>
                        <span className="text-[11px] text-red-600 font-semibold shrink-0">
                          {diasAtras === 1 ? 'Ontem' : `${diasAtras}d atrás`}
                        </span>
                      </div>
                    )
                  })}
                  {prazosVencidos.length > 20 && (
                    <p className="px-4 py-2 text-[11px] text-red-400 text-center bg-red-50/50">
                      + {prazosVencidos.length - 20} mais vencidos
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Próximos */}
            <div>
              <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">
                Próximos Prazos
              </p>
              {prazosProximos.length === 0 ? (
                <div className="py-10 text-center">
                  <CheckCircle2 size={28} className="mx-auto text-[#D0DCDC] mb-2" />
                  <p className="text-[13px] text-[#9ca3af]">Nenhum prazo pendente</p>
                </div>
              ) : (
                <div className="rounded-xl border border-[#f3f4f6] overflow-hidden divide-y divide-[#f9fafb]">
                  {prazosProximos.map(i => {
                    const data = i.prazo_final ?? i.data_inicio
                    const diasFaltam = Math.round((new Date(data + 'T12:00:00').getTime() - new Date().getTime()) / 86_400_000)
                    const urgente = diasFaltam <= 3
                    return (
                      <div key={i.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#fafbfb] transition-colors">
                        <div className={cn('w-1.5 h-10 rounded-full shrink-0', urgente ? 'bg-amber-400' : 'bg-[#D0DCDC]')} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[#0f1923]">{i.titulo}</p>
                          {i.processo && <p className="text-[11px] text-[#9aabb8] truncate">{i.processo.titulo}</p>}
                        </div>
                        <span className={cn('text-[11px] font-semibold shrink-0', PRIOR_COLOR[i.prioridade] ?? 'text-slate-600')}>
                          {i.prioridade}
                        </span>
                        <span className={cn('text-[11px] px-2.5 py-1 rounded-lg font-semibold shrink-0',
                          diasFaltam === 0 ? 'bg-amber-100 text-amber-700' : urgente ? 'bg-orange-50 text-orange-700' : 'bg-[#F3F1EE] text-[#7a8899]')}>
                          {diasFaltam === 0 ? 'Hoje' : diasFaltam === 1 ? 'Amanhã' : `${diasFaltam}d`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Aba Publicações ─────────────────────────────────────────────── */}
        {aba === 'publicacoes' && (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
                <p className="text-[40px] font-black text-amber-700 tabular-nums leading-none">{publicacoes.length}</p>
                <p className="text-[12px] text-amber-600 mt-2 font-medium">Publicações não tratadas</p>
              </div>
              <div className="bg-[#f9fafb] rounded-xl p-5 border border-[#f3f4f6]">
                <p className="text-[12px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">Por tribunal</p>
                {(() => {
                  const por: Record<string, number> = {}
                  publicacoes.forEach(p => { const t = p.tribunal ?? 'Sem tribunal'; por[t] = (por[t] ?? 0) + 1 })
                  return Object.entries(por).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, n]) => (
                    <div key={t} className="flex justify-between text-[12px] py-0.5">
                      <span className="text-[#374151] truncate">{t}</span>
                      <span className="font-bold text-[#0f1923] ml-2">{n}</span>
                    </div>
                  ))
                })()}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">Lista de não tratadas</p>
              <button
                onClick={() => downloadCSV(publicacoes.map(p => ({
                  numero: p.numero_processo ?? '', tribunal: p.tribunal ?? '', data: p.data_publicacao ?? '', tipo: TIPO_PUB[p.tipo_publicacao] ?? p.tipo_publicacao,
                })), [
                  { key: 'numero', label: 'Processo' }, { key: 'tribunal', label: 'Tribunal' },
                  { key: 'data', label: 'Data Publicação' }, { key: 'tipo', label: 'Tipo' },
                ], 'publicacoes-nao-tratadas.csv')}
                className="flex items-center gap-1.5 text-[11px] text-[#9ca3af] hover:text-[#374151] transition-colors"
              >
                <Download size={12} /> CSV
              </button>
            </div>

            {publicacoes.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle2 size={32} className="mx-auto text-emerald-300 mb-3" />
                <p className="text-[13px] text-[#9ca3af]">Todas as publicações foram tratadas</p>
              </div>
            ) : (
              <div className="rounded-xl border border-[#f3f4f6] overflow-hidden">
                <table className="w-full">
                  <thead><tr className="bg-[#f9fafb] border-b border-[#f3f4f6]">
                    {['Processo', 'Tribunal', 'Data', 'Tipo', ''].map((h, i) => (
                      <th key={i} className={cn('text-left text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5', i === 0 ? 'px-5' : 'px-4')}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {publicacoes.slice(0, 50).map(p => (
                      <tr key={p.id} className="border-b border-[#f9fafb] last:border-0 hover:bg-[#fafbfb] transition-colors">
                        <td className="px-5 py-3 text-[13px] font-medium text-[#0f1923]">{p.numero_processo ?? '—'}</td>
                        <td className="px-4 py-3 text-[12px] text-[#374151]">{p.tribunal ?? '—'}</td>
                        <td className="px-4 py-3 text-[12px] text-[#374151]">{p.data_publicacao ? formatDate(p.data_publicacao) : '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                            {TIPO_PUB[p.tipo_publicacao] ?? p.tipo_publicacao}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link href="/publicacoes" className="text-[11px] text-[#1D5F60] hover:underline flex items-center gap-0.5">
                            Tratar <ArrowUpRight size={10} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {publicacoes.length > 50 && (
                  <p className="px-5 py-3 text-[11px] text-[#9ca3af] border-t border-[#f3f4f6]">
                    Mostrando 50 de {publicacoes.length} — exporte CSV para ver todos
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Aba Produtividade ───────────────────────────────────────────── */}
        {aba === 'produtividade' && (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#f9fafb] rounded-xl p-4 border border-[#f3f4f6] text-center">
                <p className="text-[28px] font-bold text-[#0f1923] tabular-nums">{processos.filter(p => p.status === 'ativo').length}</p>
                <p className="text-[11px] text-[#9ca3af] mt-1">Processos ativos</p>
              </div>
              <div className="bg-[#f9fafb] rounded-xl p-4 border border-[#f3f4f6] text-center">
                <p className="text-[28px] font-bold text-[#0f1923] tabular-nums">{kanbanTasks.filter(k => k.status === 'concluido').length}</p>
                <p className="text-[11px] text-[#9ca3af] mt-1">Tarefas concluídas</p>
              </div>
              <div className="bg-[#f9fafb] rounded-xl p-4 border border-[#f3f4f6] text-center">
                <p className="text-[28px] font-bold text-[#0f1923] tabular-nums">{produtividade.length}</p>
                <p className="text-[11px] text-[#9ca3af] mt-1">Advogados ativos</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">Processos por advogado</p>
                <button
                  onClick={() => downloadCSV(produtividade, [
                    { key: 'nome', label: 'Nome' }, { key: 'processos', label: 'Total processos' }, { key: 'ativos', label: 'Ativos' },
                  ], 'produtividade.csv')}
                  className="flex items-center gap-1.5 text-[11px] text-[#9ca3af] hover:text-[#374151] transition-colors"
                >
                  <Download size={12} /> CSV
                </button>
              </div>
              <div className="rounded-xl border border-[#f3f4f6] overflow-hidden">
                <table className="w-full">
                  <thead><tr className="bg-[#f9fafb] border-b border-[#f3f4f6]">
                    <th className="text-left text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-5">Responsável</th>
                    <th className="text-left text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Perfil</th>
                    <th className="text-right text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Total</th>
                    <th className="text-right text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Ativos</th>
                  </tr></thead>
                  <tbody>
                    {produtividade.map(p => (
                      <tr key={p.id} className="border-b border-[#f9fafb] last:border-0 hover:bg-[#fafbfb] transition-colors">
                        <td className="px-5 py-3 text-[13px] font-medium text-[#0f1923]">{p.nome}</td>
                        <td className="px-4 py-3 text-[12px] text-[#9ca3af] capitalize">{p.role}</td>
                        <td className="px-4 py-3 text-right text-[13px] font-bold text-[#0f1923]">{p.processos}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-[12px] font-semibold text-emerald-600">{p.ativos}</span>
                        </td>
                      </tr>
                    ))}
                    {produtividade.length === 0 && (
                      <tr><td colSpan={4} className="px-5 py-8 text-center text-[12px] text-[#9ca3af]">Sem dados de produtividade</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Aba Por Cliente ─────────────────────────────────────────────── */}
        {aba === 'cliente' && (
          <div className="p-6 space-y-5">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">
                Buscar cliente
              </p>
              <p className="text-[12px] text-[#9ca3af]">
                Busque por razão social, CNPJ completo, raiz do CNPJ (8 dígitos), CPF, nome fantasia ou sócio/representante.
              </p>
              <ClienteBuscaInput
                selected={clienteSelecionado}
                onSelect={setClienteSelecionado}
                onClear={() => setClienteSelecionado(null)}
              />
            </div>

            {clienteSelecionado ? (
              <RelatorioCliente
                cliente={clienteSelecionado}
                profiles={profiles}
              />
            ) : (
              <div className="py-16 flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 bg-[#f3f4f6] rounded-lg flex items-center justify-center">
                  <Building2 size={22} className="text-[#D0DCDC]" />
                </div>
                <p className="text-[13px] font-medium text-[#9ca3af]">Selecione um cliente para gerar o relatório</p>
                <p className="text-[11px] text-[#c4cdd5] max-w-sm">
                  Você pode buscar por CNPJ completo, raiz do CNPJ para localizar grupo econômico,
                  CPF para pessoa física, ou nome do sócio/representante.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Aba Financeiro (gerente/socio) ──────────────────────────────── */}
        {aba === 'financeiro' && verFinanceiro && fin && (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#e6f4ee] rounded-xl p-5 border border-[#b8dfc9] flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center"><TrendingUp size={18} className="text-[#1a7a45]" /></div>
                <div>
                  <p className="text-[24px] font-bold text-[#1a7a45] tabular-nums">{formatCurrency(fin.recebido)}</p>
                  <p className="text-[12px] text-[#1a7a45]/70">Total recebido</p>
                </div>
              </div>
              <div className="bg-[#fde8e8] rounded-xl p-5 border border-[#f5c6c6] flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center"><TrendingDown size={18} className="text-[#a93226]" /></div>
                <div>
                  <p className="text-[24px] font-bold text-[#a93226] tabular-nums">{formatCurrency(fin.despPago)}</p>
                  <p className="text-[12px] text-[#a93226]/70">Total despesas pagas</p>
                </div>
              </div>
              <div className="bg-[#e8f0fb] rounded-xl p-5 border border-[#b8d0f5] flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center"><Clock size={18} className="text-[#1a4d9e]" /></div>
                <div>
                  <p className="text-[24px] font-bold text-[#1a4d9e] tabular-nums">{formatCurrency(fin.aReceber)}</p>
                  <p className="text-[12px] text-[#1a4d9e]/70">A receber</p>
                </div>
              </div>
              <div className={cn('rounded-xl p-5 border flex items-center gap-4', fin.saldo >= 0 ? 'bg-[#e6f4ee] border-[#b8dfc9]' : 'bg-[#fde8e8] border-[#f5c6c6]')}>
                <div className={cn('w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center')}>
                  <DollarSign size={18} className={fin.saldo >= 0 ? 'text-[#1a7a45]' : 'text-[#a93226]'} />
                </div>
                <div>
                  <p className={cn('text-[24px] font-bold tabular-nums', fin.saldo >= 0 ? 'text-[#1a7a45]' : 'text-[#a93226]')}>{formatCurrency(Math.abs(fin.saldo))}</p>
                  <p className={cn('text-[12px]', fin.saldo >= 0 ? 'text-[#1a7a45]/70' : 'text-[#a93226]/70')}>Saldo {fin.saldo >= 0 ? 'positivo' : 'negativo'}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Link href="/financeiro" className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-[#1D5F60] border border-[#145A5B]/30 rounded-xl hover:bg-[#E8F2F2] transition-colors">
                Ver módulo financeiro completo <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SelectFiltro({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="pl-3 pr-7 py-1.5 text-[12px] bg-white border border-[#e5e7eb] rounded-lg outline-none focus:border-[#1D5F60] text-[#374151] appearance-none">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  )
}
