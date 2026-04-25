'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Scale, Clock, AlertCircle, CheckCircle2, Download,
  Loader2, FileText, Building2, User, Printer,
  ChevronDown, ChevronRight, Newspaper,
} from 'lucide-react'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import type { RelatorioClienteData } from '@/app/api/relatorios/cliente/route'
import type { ClienteBuscaResult } from '@/app/api/clientes/busca/route'

// ── Helpers visuais ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  ativo:     'bg-emerald-50 text-emerald-700',
  suspenso:  'bg-amber-50 text-amber-700',
  arquivado: 'bg-slate-50 text-slate-600',
  encerrado: 'bg-blue-50 text-blue-700',
}
const STATUS_LABEL: Record<string, string> = {
  ativo: 'Ativo', suspenso: 'Suspenso', arquivado: 'Arquivado', encerrado: 'Encerrado',
}
const AREA_LABEL: Record<string, string> = {
  civil: 'Cível', trabalhista: 'Trabalhista', criminal: 'Criminal',
  tributario: 'Tributário', previdenciario: 'Previdenciário',
  administrativo: 'Administrativo', familia: 'Família',
  empresarial: 'Empresarial', outro: 'Outro',
}

function downloadCSV(dados: Record<string, unknown>[], campos: { key: string; label: string }[], nome: string) {
  const header = campos.map(c => `"${c.label}"`).join(',')
  const rows = dados.map(d =>
    campos.map(c => {
      const v = c.key.split('.').reduce((o: unknown, k) => (o as Record<string, unknown>)?.[k], d) ?? ''
      return `"${String(v).replace(/"/g, '""')}"`
    }).join(',')
  )
  const csv = '﻿' + [header, ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = nome; document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

// ── Tipos de filtro ────────────────────────────────────────────────────────────

interface Filtros {
  periodo:       string
  status:        string
  area_direito:  string
  responsavel_id: string
  tipo_processo: string
}

interface Props {
  cliente:  ClienteBuscaResult
  profiles: Array<{ id: string; nome: string; role: string }>
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function RelatorioCliente({ cliente, profiles }: Props) {
  const [data,         setData]         = useState<RelatorioClienteData | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [showPrazos,   setShowPrazos]   = useState(true)
  const [showProcessos,setShowProcessos] = useState(true)
  const [showTarefas,  setShowTarefas]  = useState(false)
  const [showPubs,     setShowPubs]     = useState(false)

  const [filtros, setFiltros] = useState<Filtros>({
    periodo:        'todos',
    status:         '',
    area_direito:   '',
    responsavel_id: '',
    tipo_processo:  '',
  })

  const setFiltro = useCallback((key: keyof Filtros, val: string) => {
    setFiltros(prev => ({ ...prev, [key]: val }))
  }, [])

  // Busca dados quando cliente ou filtros mudam
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    const params = new URLSearchParams({ cliente_id: cliente.id })
    if (filtros.periodo)        params.set('periodo', filtros.periodo)
    if (filtros.status)         params.set('status', filtros.status)
    if (filtros.area_direito)   params.set('area_direito', filtros.area_direito)
    if (filtros.responsavel_id) params.set('responsavel_id', filtros.responsavel_id)

    fetch(`/api/relatorios/cliente?${params}`)
      .then(r => r.ok ? r.json() : r.json().then(b => Promise.reject(b.error ?? 'Erro ao buscar dados')))
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(String(e)); setLoading(false) } })

    return () => { cancelled = true }
  }, [cliente.id, filtros])

  const hoje = new Date().toISOString().slice(0, 10)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header do cliente */}
      <div className="flex items-start gap-4 p-5 bg-[#f0f7f7] rounded-2xl border border-[#145A5B]/20">
        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
          {cliente.tipo_pessoa === 'juridica'
            ? <Building2 size={20} className="text-[#145A5B]" />
            : <User size={20} className="text-[#145A5B]" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[16px] font-bold text-[#0f1923]">{cliente.nome}</h3>
          {cliente.nome_fantasia && (
            <p className="text-[12px] text-[#6b7280] mt-0.5">{cliente.nome_fantasia}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {cliente.cpf_cnpj && (
              <span className="text-[11px] text-[#374151] font-mono bg-white border border-[#e5e7eb] px-2.5 py-1 rounded-lg">
                {cliente.cpf_cnpj}
              </span>
            )}
            {cliente.cnpj_raiz && (
              <span className="text-[11px] text-[#9ca3af] border border-[#e5e7eb] bg-white px-2.5 py-1 rounded-lg font-mono">
                Raiz: {cliente.cnpj_raiz}
              </span>
            )}
            {cliente.socio_representante && (
              <span className="text-[11px] text-[#6b7280] italic">
                Sócio/Rep.: {cliente.socio_representante}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-2 text-[11px] text-[#6b7280] hover:text-[#374151] border border-[#e5e7eb] bg-white rounded-xl hover:bg-[#f9fafb] transition-colors shrink-0"
        >
          <Printer size={12} /> Imprimir
        </button>
      </div>

      {/* Filtros do relatório */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider shrink-0">Filtrar</span>

        <Sel value={filtros.periodo} onChange={v => setFiltro('periodo', v)} options={[
          { value: 'todos', label: 'Todo período' },
          { value: 'este-mes', label: 'Este mês' },
          { value: 'trimestre', label: 'Últimos 3 meses' },
          { value: 'ano', label: 'Este ano' },
        ]} />
        <Sel value={filtros.status} onChange={v => setFiltro('status', v)} options={[
          { value: '', label: 'Todos os status' },
          { value: 'ativo', label: 'Ativo' },
          { value: 'suspenso', label: 'Suspenso' },
          { value: 'arquivado', label: 'Arquivado' },
          { value: 'encerrado', label: 'Encerrado' },
        ]} />
        <Sel value={filtros.area_direito} onChange={v => setFiltro('area_direito', v)} options={[
          { value: '', label: 'Todas as áreas' },
          ...Object.entries(AREA_LABEL).map(([v, l]) => ({ value: v, label: l })),
        ]} />
        <Sel value={filtros.responsavel_id} onChange={v => setFiltro('responsavel_id', v)} options={[
          { value: '', label: 'Todos os responsáveis' },
          ...profiles
            .filter(p => ['advogado', 'gerente', 'socio'].includes(p.role))
            .map(p => ({ value: p.id, label: p.nome })),
        ]} />
        <button
          onClick={() => setFiltros({ periodo: 'todos', status: '', area_direito: '', responsavel_id: '', tipo_processo: '' })}
          className="text-[11px] text-[#9ca3af] hover:text-[#374151] transition-colors px-2 py-1.5 rounded-lg hover:bg-[#f9fafb]"
        >
          Limpar
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-[#9ca3af]">
          <Loader2 size={16} className="animate-spin text-[#145A5B]" />
          Carregando dados do cliente…
        </div>
      )}

      {/* Erro */}
      {!loading && error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Conteúdo */}
      {!loading && !error && data && (
        <div className="space-y-5">

          {/* Cards resumo */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard label="Total processos" value={data.resumo.total_processos} color="text-[#0f1923]" bg="bg-[#f9fafb]" />
            <MetricCard label="Processos ativos" value={data.resumo.ativos} color="text-emerald-600" bg="bg-emerald-50" />
            <MetricCard label="Prazos vencidos" value={data.resumo.prazos_vencidos} color="text-red-600" bg="bg-red-50" />
            <MetricCard label="Próximos prazos" value={data.resumo.prazos_proximos} color="text-amber-600" bg="bg-amber-50" />
            <MetricCard label="Tarefas abertas" value={data.resumo.tarefas_abertas} color="text-blue-600" bg="bg-blue-50" />
            <MetricCard label="Pub. não tratadas" value={data.resumo.pub_nao_tratadas} color="text-violet-600" bg="bg-violet-50" />
          </div>

          {/* Financeiro (se disponível) */}
          {data.financeiro && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 p-4 bg-[#f9fafb] rounded-2xl border border-[#f3f4f6]">
              <FinCard label="Receita recebida"  value={data.financeiro.receita_paga} color="text-emerald-700" />
              <FinCard label="Despesas pagas"     value={data.financeiro.despesa_paga} color="text-red-700" />
              <FinCard label="A receber"          value={data.financeiro.a_receber}    color="text-blue-700" />
              <FinCard label="Valores vencidos"   value={data.financeiro.vencidos}     color="text-orange-700" />
            </div>
          )}

          {/* Processos */}
          <Section
            title="Processos"
            count={data.processos.length}
            open={showProcessos}
            toggle={() => setShowProcessos(v => !v)}
            icon={<Scale size={13} />}
            action={data.processos.length > 0 ? (
              <button
                onClick={() => downloadCSV(
                  data.processos.map(p => ({
                    numero:        p.numero_processo ?? '',
                    titulo:        p.titulo,
                    status:        STATUS_LABEL[p.status] ?? p.status,
                    area:          AREA_LABEL[p.area_direito] ?? p.area_direito,
                    tribunal:      p.tribunal ?? '',
                    distribuicao:  p.data_distribuicao ?? '',
                    responsavel:   p.advogado?.nome ?? '',
                    parte_contraria: p.partes.filter(pt => pt.tipo_parte === 'reu').map(pt => pt.pessoa_nome).join('; '),
                  })),
                  [
                    { key: 'numero', label: 'Número' }, { key: 'titulo', label: 'Título' },
                    { key: 'status', label: 'Status' }, { key: 'area', label: 'Área' },
                    { key: 'tribunal', label: 'Tribunal' }, { key: 'distribuicao', label: 'Distribuição' },
                    { key: 'responsavel', label: 'Responsável' }, { key: 'parte_contraria', label: 'Parte Contrária' },
                  ],
                  `processos-${cliente.nome.replace(/\s+/g, '_')}.csv`
                )}
                className="flex items-center gap-1.5 text-[11px] text-[#9ca3af] hover:text-[#374151] transition-colors"
              >
                <Download size={11} /> CSV
              </button>
            ) : null}
          >
            {data.processos.length === 0 ? (
              <EmptyState text="Nenhum processo vinculado" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="bg-[#f9fafb] border-b border-[#f3f4f6]">
                      {['Número', 'Título', 'Status', 'Área', 'Responsável', 'Parte contrária', 'Tribunal'].map(h => (
                        <th key={h} className="text-left text-[10px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4 first:pl-5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.processos.map(p => {
                      const contrarias = p.partes.filter(pt => pt.tipo_parte === 'reu').map(pt => pt.pessoa_nome)
                      return (
                        <tr key={p.id} className="border-b border-[#f9fafb] last:border-0 hover:bg-[#fafbfb] transition-colors">
                          <td className="pl-5 pr-4 py-3 text-[12px] font-mono text-[#374151] whitespace-nowrap">
                            {p.numero_processo ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-[12px] font-medium text-[#0f1923] max-w-[200px] truncate" title={p.titulo}>
                            {p.titulo}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', STATUS_BADGE[p.status] ?? 'bg-slate-50 text-slate-600')}>
                              {STATUS_LABEL[p.status] ?? p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-[#6b7280]">
                            {AREA_LABEL[p.area_direito] ?? p.area_direito}
                          </td>
                          <td className="px-4 py-3 text-[11px] text-[#374151]">
                            {p.advogado?.nome ?? <span className="text-[#c4cdd5]">—</span>}
                          </td>
                          <td className="px-4 py-3 text-[11px] text-[#374151] max-w-[160px] truncate" title={contrarias.join(', ')}>
                            {contrarias.length > 0 ? contrarias[0] + (contrarias.length > 1 ? ` +${contrarias.length - 1}` : '') : <span className="text-[#c4cdd5]">—</span>}
                          </td>
                          <td className="px-4 py-3 text-[11px] text-[#9ca3af]">
                            {p.tribunal ?? '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Prazos e Audiências */}
          <Section
            title="Prazos e Audiências"
            count={data.prazos.length}
            open={showPrazos}
            toggle={() => setShowPrazos(v => !v)}
            icon={<Clock size={13} />}
          >
            {data.prazos.length === 0 ? (
              <EmptyState text="Nenhum prazo ou audiência" />
            ) : (
              <div className="divide-y divide-[#f9fafb]">
                {data.prazos.map(p => {
                  const dataRef  = p.prazo_final ?? p.data_inicio
                  const vencido  = p.status === 'pendente' && dataRef < hoje
                  const dDias    = Math.round((new Date(dataRef + 'T12:00:00').getTime() - new Date().getTime()) / 86_400_000)
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#fafbfb] transition-colors">
                      <div className={cn('w-1.5 h-10 rounded-full shrink-0', vencido ? 'bg-red-400' : dDias <= 3 ? 'bg-amber-400' : 'bg-[#D0DCDC]')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[#0f1923] truncate">{p.titulo}</p>
                        <span className="text-[10px] text-[#9ca3af] capitalize">{p.tipo}</span>
                      </div>
                      <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-lg shrink-0',
                        vencido
                          ? 'bg-red-50 text-red-700'
                          : dDias === 0 ? 'bg-amber-50 text-amber-700'
                          : dDias <= 3 ? 'bg-orange-50 text-orange-700'
                          : 'bg-[#f3f4f6] text-[#7a8899]'
                      )}>
                        {vencido ? `${Math.abs(dDias)}d atrás` : dDias === 0 ? 'Hoje' : dDias === 1 ? 'Amanhã' : `${dDias}d`}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {/* Tarefas Kanban */}
          <Section
            title="Tarefas"
            count={data.tarefas.length}
            open={showTarefas}
            toggle={() => setShowTarefas(v => !v)}
            icon={<CheckCircle2 size={13} />}
          >
            {data.tarefas.length === 0 ? (
              <EmptyState text="Nenhuma tarefa vinculada" />
            ) : (
              <div className="divide-y divide-[#f9fafb]">
                {data.tarefas.slice(0, 30).map(t => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-[#fafbfb] transition-colors">
                    <span className="text-[12px] text-[#374151] truncate flex-1">{t.titulo}</span>
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full ml-3 shrink-0',
                      t.status === 'concluido' ? 'bg-emerald-50 text-emerald-700'
                      : t.status === 'fazendo'  ? 'bg-blue-50 text-blue-700'
                      : 'bg-[#f3f4f6] text-[#9ca3af]'
                    )}>
                      {TAREFA_STATUS[t.status] ?? t.status}
                    </span>
                  </div>
                ))}
                {data.tarefas.length > 30 && (
                  <p className="px-4 py-2 text-[11px] text-[#9ca3af] text-center">+{data.tarefas.length - 30} tarefas</p>
                )}
              </div>
            )}
          </Section>

          {/* Publicações */}
          <Section
            title="Publicações"
            count={data.publicacoes.length}
            open={showPubs}
            toggle={() => setShowPubs(v => !v)}
            icon={<Newspaper size={13} />}
          >
            {data.publicacoes.length === 0 ? (
              <EmptyState text="Nenhuma publicação encontrada" />
            ) : (
              <div className="divide-y divide-[#f9fafb]">
                {data.publicacoes.slice(0, 20).map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#fafbfb] transition-colors">
                    <div className="flex-1 min-w-0">
                      <span className="text-[12px] text-[#374151] font-mono">{p.numero_processo ?? '—'}</span>
                      <span className="mx-2 text-[#c4cdd5]">·</span>
                      <span className="text-[11px] text-[#9ca3af]">{p.tribunal ?? '—'}</span>
                    </div>
                    {p.data_publicacao && (
                      <span className="text-[11px] text-[#9ca3af] shrink-0">{formatDate(p.data_publicacao)}</span>
                    )}
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0',
                      p.status === 'nao_tratada' ? 'bg-amber-50 text-amber-700' : 'bg-[#f3f4f6] text-[#9ca3af]'
                    )}>
                      {p.status === 'nao_tratada' ? 'Não tratada' : 'Tratada'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Documentos */}
          {data.documentos_count > 0 && (
            <div className="flex items-center gap-3 p-4 bg-[#f9fafb] rounded-xl border border-[#f3f4f6]">
              <FileText size={15} className="text-[#9ca3af] shrink-0" />
              <span className="text-[13px] text-[#374151]">
                <span className="font-bold">{data.documentos_count}</span> documento{data.documentos_count !== 1 ? 's' : ''} vinculado{data.documentos_count !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Sem dados */}
      {!loading && !error && !data && (
        <div className="py-12 text-center text-[13px] text-[#9ca3af]">
          <Scale size={28} className="mx-auto mb-3 text-[#D0DCDC]" />
          Selecione um cliente para gerar o relatório
        </div>
      )}
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function MetricCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={cn('rounded-xl p-3.5 border border-[#f3f4f6] text-center', bg)}>
      <p className={cn('text-[24px] font-bold tabular-nums leading-none', color)}>{value}</p>
      <p className="text-[10px] text-[#9ca3af] mt-1.5 leading-tight">{label}</p>
    </div>
  )
}

function FinCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <p className={cn('text-[18px] font-bold tabular-nums', color)}>{formatCurrency(value)}</p>
      <p className="text-[10px] text-[#9ca3af] mt-1">{label}</p>
    </div>
  )
}

function Section({
  title, count, open, toggle, icon, children, action,
}: {
  title: string
  count: number
  open: boolean
  toggle: () => void
  icon?: React.ReactNode
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-[#f3f4f6] overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-5 py-3.5 bg-[#f9fafb] border-b border-[#f3f4f6] hover:bg-[#f3f4f6] transition-colors text-left"
      >
        <span className="text-[#9ca3af]">{icon}</span>
        <span className="text-[12px] font-semibold text-[#374151] flex-1">{title}</span>
        <span className="text-[11px] text-[#9ca3af] tabular-nums">{count}</span>
        {action && <span onClick={e => e.stopPropagation()}>{action}</span>}
        {open ? <ChevronDown size={13} className="text-[#9ca3af]" /> : <ChevronRight size={13} className="text-[#9ca3af]" />}
      </button>
      {open && <div className="bg-white">{children}</div>}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-10 text-center text-[12px] text-[#9ca3af]">
      <CheckCircle2 size={22} className="mx-auto mb-2 text-[#D0DCDC]" />
      {text}
    </div>
  )
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="pl-3 pr-7 py-1.5 text-[12px] bg-white border border-[#e5e7eb] rounded-lg outline-none focus:border-[#145A5B] text-[#374151] appearance-none"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  )
}

const TAREFA_STATUS: Record<string, string> = {
  a_fazer:       'A Fazer',
  fazendo:       'Fazendo',
  com_pendencia: 'Pendência',
  concluido:     'Concluído',
}
