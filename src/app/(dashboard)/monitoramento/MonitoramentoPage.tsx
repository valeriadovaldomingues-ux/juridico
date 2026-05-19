'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  RefreshCw, Play, Clock, Users, CheckCircle2, AlertTriangle,
  Gavel, Search, ChevronDown, ChevronLeft, ChevronRight,
  X, Eye, Filter, BarChart2, FileText, ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Advogado {
  id: string
  nome_completo: string
  oab_numero: string
  oab_uf: string
  ativo: boolean
  created_at: string
}

interface PublicacaoMonitorada {
  id: string
  advogado_monitorado_id?: string
  nome_pesquisado: string
  oab_pesquisada?: string
  processo_id?: string
  numero_processo?: string
  tribunal?: string
  data_publicacao?: string
  data_disponibilizacao?: string
  titulo?: string
  resumo?: string
  termo_encontrado?: string
  tipo_resultado?: string
  tipo_publicacao?: string
  prazo_detectado: boolean
  prazo_dias?: number
  prazo_data?: string
  prazo_descricao?: string
  audiencia_detectada: boolean
  audiencia_data?: string
  audiencia_descricao?: string
  hash_publicacao?: string
  hash?: string
  status_tratamento?: 'nova' | 'tratada' | 'descartada'
  status?: 'nao_tratada' | 'tratada' | 'descartada'
  origem: string
  created_at: string
  advogado?: { id: string; nome_completo: string; oab_numero: string; oab_uf: string } | null
  processo?: { id: string; titulo: string; numero_processo?: string } | null
}

interface Log {
  id: string
  executado_em: string
  total_advogados: number
  total_pesquisas: number
  total_encontradas: number
  total_novas: number
  total_duplicadas: number
  duracao_ms?: number
  erro?: string
  detalhes_json?: any
  disparado_por: string
}

interface FonteMonitoramentoResumo {
  id: string
  nome: string
  tribunal: string
  ramo: string
  status: 'ativo' | 'preparado' | 'pendente' | 'erro' | 'requer_credencial'
  descricao: string
  requerCredencial?: boolean
  ultima_execucao?: string | null
  total_encontrado?: number | null
  total_inserido?: number | null
  total_ignorado?: number | null
  erro?: string | null
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  nova:        { label: 'Nova',        bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',  dot: 'bg-amber-400'  },
  tratada:     { label: 'Tratada',     bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',dot: 'bg-emerald-400'},
  descartada:  { label: 'Descartada',  bg: 'bg-slate-100',  text: 'text-slate-500',   border: 'border-slate-200',  dot: 'bg-slate-300'  },
}

const TIPO_CFG: Record<string, { label: string; bg: string; text: string }> = {
  intimacao:  { label: 'Intimação',  bg: 'bg-rose-50',   text: 'text-rose-700'   },
  publicacao: { label: 'Publicação', bg: 'bg-blue-50',   text: 'text-blue-700'   },
  despacho:   { label: 'Despacho',   bg: 'bg-amber-50',  text: 'text-amber-700'  },
  sentenca:   { label: 'Sentença',   bg: 'bg-purple-50', text: 'text-purple-700' },
  acordao:    { label: 'Acórdão',    bg: 'bg-indigo-50', text: 'text-indigo-700' },
  outro:      { label: 'Outro',      bg: 'bg-slate-100', text: 'text-slate-600'  },
}

const ORIGEM_CFG: Record<string, { label: string; color: string }> = {
  datajud_oab:       { label: 'Por OAB',       color: 'text-emerald-600' },
  datajud_nome:      { label: 'Por nome',      color: 'text-blue-600'    },
  datajud_processo:  { label: 'Por processo',  color: 'text-indigo-600'  },
  datajud_combinado: { label: 'Combinado',     color: 'text-violet-600'  },
  manual:            { label: 'Manual',        color: 'text-slate-500'   },
}

const FONTE_STATUS_CFG: Record<FonteMonitoramentoResumo['status'], { label: string; bg: string; text: string; border: string }> = {
  ativo:             { label: 'Ativo',             bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  preparado:         { label: 'Preparado',         bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'    },
  pendente:          { label: 'Pendente',          bg: 'bg-slate-100',  text: 'text-slate-600',   border: 'border-slate-200'   },
  erro:              { label: 'Erro',              bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200'     },
  requer_credencial: { label: 'Requer credencial', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
}

const PAGE_SIZE = 25

function fmt(iso?: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60000)
  if (min < 60)  return `${min}min atrás`
  const h = Math.floor(min / 60)
  if (h < 24)    return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

function statusDaPublicacao(pub: PublicacaoMonitorada): 'nova' | 'tratada' | 'descartada' {
  if (pub.status_tratamento) return pub.status_tratamento
  if (pub.status === 'tratada') return 'tratada'
  if (pub.status === 'descartada') return 'descartada'
  return 'nova'
}

function statusParaTabelaPublicacoes(status: string): 'nao_tratada' | 'tratada' | 'descartada' {
  if (status === 'tratada') return 'tratada'
  if (status === 'descartada') return 'descartada'
  return 'nao_tratada'
}

function tipoDaPublicacao(pub: PublicacaoMonitorada) {
  return pub.tipo_resultado ?? pub.tipo_publicacao ?? 'publicacao'
}

function textoDaPublicacao(pub: PublicacaoMonitorada) {
  return pub.titulo ?? pub.resumo ?? pub.numero_processo ?? ''
}

// ─── Status pill ─────────────────────────────────────────────────────────────

function StatusPill({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false)
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.nova

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap transition-colors',
          cfg.bg, cfg.text, cfg.border
        )}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
        {cfg.label}
        <ChevronDown size={9} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 z-30 bg-white rounded-xl shadow-lg border border-[#E2DDD8] py-1 min-w-[140px]">
          {Object.entries(STATUS_CFG).map(([k, v]) => (
            <button key={k} onClick={() => { onChange(k); setOpen(false) }}
              className={cn('w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[#F3F1EE] text-left',
                k === status ? `${v.text} font-semibold` : 'text-[#4a5a6a]')}>
              <span className={cn('w-2 h-2 rounded-full', v.dot)} /> {v.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Detail modal ─────────────────────────────────────────────────────────────

function DetalheModal({
  pub, onClose, onStatusChange,
}: {
  pub: PublicacaoMonitorada
  onClose: () => void
  onStatusChange: (id: string, s: string) => void
}) {
  const tipo    = TIPO_CFG[tipoDaPublicacao(pub)] ?? TIPO_CFG.outro
  const origem  = ORIGEM_CFG[pub.origem] ?? { label: pub.origem, color: 'text-slate-500' }
  const status  = statusDaPublicacao(pub)
  const texto   = textoDaPublicacao(pub)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-[#F0F6F6]">
          <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 mt-0.5', tipo.bg, tipo.text)}>
            {tipo.label}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-[#0f1923]">
              {pub.tribunal ?? 'Tribunal não informado'}
              {pub.numero_processo && (
                <span className="ml-2 font-mono font-normal text-[12px] text-[#7a8899]">{pub.numero_processo}</span>
              )}
            </p>
            <p className="text-[12px] text-[#9aabb8] mt-0.5">{fmt(pub.data_publicacao)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#F0F6F6] text-[#9aabb8]">
            <X size={15} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Prazo / Audiência */}
          {(pub.prazo_detectado || pub.audiencia_detectada) && (
            <div className="space-y-2">
              {pub.prazo_detectado && (
                <div className="p-3.5 bg-orange-50 rounded-xl border border-orange-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={14} className="text-orange-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[13px] font-bold text-orange-700">Prazo detectado</p>
                      {pub.prazo_dias && <p className="text-[12px] text-orange-600 mt-0.5">{pub.prazo_dias} dias{pub.prazo_data ? ` · até ${fmt(pub.prazo_data)}` : ''}</p>}
                      {!pub.prazo_dias && pub.prazo_data && <p className="text-[12px] text-orange-600 mt-0.5">Data limite: {fmt(pub.prazo_data)}</p>}
                      {pub.prazo_descricao && <p className="text-[11px] text-orange-500 mt-1 line-clamp-2">{pub.prazo_descricao}</p>}
                    </div>
                  </div>
                </div>
              )}
              {pub.audiencia_detectada && (
                <div className="flex gap-3 p-3.5 bg-rose-50 rounded-xl border border-rose-100">
                  <Gavel size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] font-semibold text-rose-700">Audiência detectada</p>
                    {pub.audiencia_data && <p className="text-[12px] text-rose-600">Data: {fmt(pub.audiencia_data)}</p>}
                    {pub.audiencia_descricao && <p className="text-[11px] text-rose-500 mt-1">{pub.audiencia_descricao}</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Meta */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-wide mb-1">Advogado / Nome pesquisado</p>
              <p className="text-[13px] text-[#0f1923] font-medium">{pub.nome_pesquisado}</p>
              {pub.oab_pesquisada && <p className="text-[11px] text-[#9aabb8]">OAB/{pub.oab_pesquisada}</p>}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-wide mb-1">Critério de busca</p>
              <p className={cn('text-[13px] font-semibold', origem.color)}>{origem.label}</p>
              {pub.termo_encontrado && <p className="text-[11px] text-[#9aabb8] mt-0.5">{pub.termo_encontrado}</p>}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-wide mb-1">Tribunal / Órgão</p>
              <p className="text-[13px] text-[#4a5a6a]">{pub.tribunal ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-wide mb-1">Capturado em</p>
              <p className="text-[12px] text-[#7a8899]">{fmt(pub.created_at)}</p>
            </div>
          </div>

          {/* Text */}
          {texto && (
            <div>
              <p className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-wide mb-2">Texto da publicação</p>
              <div className="bg-[#F3F1EE] rounded-xl p-4 text-[12px] text-[#4a5a6a] leading-relaxed font-mono whitespace-pre-wrap max-h-44 overflow-y-auto border border-[#E2DDD8]">
                {texto}
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <p className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-wide mb-2">Status</p>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(STATUS_CFG).map(([k, v]) => (
                <button key={k} onClick={() => { onStatusChange(pub.id, k); onClose() }}
                  className={cn('flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 text-[12px] font-semibold transition-all',
                    status === k
                      ? `${v.bg} ${v.text} ${v.border}`
                      : 'border-[#E2DDD8] text-[#9aabb8] hover:border-[#c8d8d8]'
                  )}>
                  <span className={cn('w-2 h-2 rounded-full', v.dot)} /> {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MonitoramentoPage({
  advogados: initialAdvogados,
  publicacoes: initialPublicacoes,
  logs: initialLogs,
  fontes,
}: {
  advogados: Advogado[]
  publicacoes: PublicacaoMonitorada[]
  logs: Log[]
  fontes: FonteMonitoramentoResumo[]
}) {
  const supabase = createClient()

  // ── Global state ──────────────────────────────────────────────────────────
  const [tab,         setTab]         = useState<'publicacoes' | 'advogados' | 'logs'>('publicacoes')
  const [advogados,   setAdvogados]   = useState(initialAdvogados)
  const [pubs,        setPubs]        = useState(initialPublicacoes)
  const [logs,        setLogs]        = useState(initialLogs)
  const [expanded,    setExpanded]    = useState<PublicacaoMonitorada | null>(null)
  const [searching,   start]          = useTransition()
  const [lastMsg,     setLastMsg]     = useState<{ ok: boolean; text: string } | null>(null)

  // ── Advogados management ──────────────────────────────────────────────────
  const [adding,   setAdding]  = useState(false)
  const [form,     setForm]    = useState({ nome_completo: '', oab_numero: '', oab_uf: '' })
  const [saving,   setSaving]  = useState(false)

  // ── Filters ───────────────────────────────────────────────────────────────
  const [fBusca,     setFBusca]     = useState('')
  const [fAdvogado,  setFAdvogado]  = useState('')
  const [fTribunal,  setFTribunal]  = useState('')
  const [fStatus,    setFStatus]    = useState('nova')
  const [fPrazo,     setFPrazo]     = useState(false)
  const [fAudiencia, setFAudiencia] = useState(false)
  const [fDe,        setFDe]        = useState('')
  const [fAte,       setFAte]       = useState('')
  const [page,       setPage]       = useState(1)

  function resetPage() { setPage(1) }

  // ── Filtered ──────────────────────────────────────────────────────────────
  const filtered = pubs.filter(p => {
    if (fStatus !== 'todos' && statusDaPublicacao(p) !== fStatus) return false
    if (fAdvogado && p.advogado_monitorado_id !== fAdvogado) return false
    if (fTribunal && p.tribunal !== fTribunal) return false
    if (fPrazo    && !p.prazo_detectado)        return false
    if (fAudiencia && !p.audiencia_detectada)   return false
    if (fDe && (p.data_publicacao ?? '') < fDe) return false
    if (fAte && (p.data_publicacao ?? '') > fAte) return false
    if (fBusca) {
      const q = fBusca.toLowerCase()
      const ok = p.nome_pesquisado.toLowerCase().includes(q)
        || (p.numero_processo ?? '').includes(q)
        || textoDaPublicacao(p).toLowerCase().includes(q)
        || (p.tribunal ?? '').toLowerCase().includes(q)
      if (!ok) return false
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalNovas   = pubs.filter(p => statusDaPublicacao(p) === 'nova').length
  const totalPrazo   = pubs.filter(p => p.prazo_detectado && statusDaPublicacao(p) === 'nova').length
  const totalAud     = pubs.filter(p => p.audiencia_detectada && statusDaPublicacao(p) === 'nova').length

  const tribunais    = [...new Set(pubs.map(p => p.tribunal).filter(Boolean))] as string[]

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handleStatusChange(id: string, status: string) {
    const statusPublicacoes = statusParaTabelaPublicacoes(status)
    setPubs(prev => prev.map(p =>
      p.id === id
        ? { ...p, status: statusPublicacoes, status_tratamento: status as PublicacaoMonitorada['status_tratamento'] }
        : p
    ))
    if (expanded?.id === id) setExpanded(prev => prev ? { ...prev, status: statusPublicacoes, status_tratamento: status as any } : null)
    await supabase.from('publicacoes').update({ status: statusPublicacoes }).eq('id', id)
  }

  async function toggleAtivo(id: string, current: boolean) {
    setAdvogados(prev => prev.map(a => a.id === id ? { ...a, ativo: !current } : a))
    await supabase.from('advogados_monitorados').update({ ativo: !current }).eq('id', id)
  }

  async function handleAdd() {
    if (!form.nome_completo.trim() || !form.oab_numero.trim() || !form.oab_uf.trim()) return
    setSaving(true)
    const { data } = await supabase.from('advogados_monitorados').insert({
      nome_completo: form.nome_completo.trim().toUpperCase(),
      oab_numero:    form.oab_numero.trim().replace(/\D/g, ''),
      oab_uf:        form.oab_uf.trim().toUpperCase().slice(0, 2),
    }).select().single()
    if (data) setAdvogados(prev => [...prev, data as Advogado])
    setForm({ nome_completo: '', oab_numero: '', oab_uf: '' })
    setAdding(false)
    setSaving(false)
  }

  function triggerSearch(fonte?: string) {
    start(async () => {
      setLastMsg(null)
      try {
        const res  = await fetch('/api/monitoramento/buscar', {
          method: 'POST',
          headers: fonte ? { 'content-type': 'application/json' } : undefined,
          body: fonte ? JSON.stringify({ fonte }) : undefined,
        })
        const data = await res.json()
        if (data.sucesso) {
          const fontesResumo = Array.isArray(data.fontes)
            ? ` · ${data.fontes.map((f: { fonte_nome: string; status: string }) => `${f.fonte_nome}: ${f.status}`).join(', ')}`
            : ''
          setLastMsg({
            ok: true,
            text: `${data.total_novas} nova(s) salva(s) em /publicacoes · ${data.total_pesquisas} fonte(s) · ${(data.duracao_ms / 1000).toFixed(1)}s${fontesResumo}`,
          })
          // Reload logs
          const { data: freshLogs } = await supabase
            .from('monitoramento_logs')
            .select('*')
            .order('executado_em', { ascending: false })
            .limit(10)
          if (freshLogs) setLogs(freshLogs as Log[])
          // Reload publications if new ones
          if (data.total_novas > 0) {
            const { data: freshPubs } = await supabase
              .from('publicacoes')
              .select('*, processo:processos(id,titulo,numero_processo)')
              .order('created_at', { ascending: false })
              .limit(500)
            if (freshPubs) setPubs(freshPubs as PublicacaoMonitorada[])
          }
        } else {
          const fontesResumo = Array.isArray(data.fontes)
            ? ` ${data.fontes.map((f: { fonte_nome: string; mensagem?: string }) => `${f.fonte_nome}: ${f.mensagem ?? 'não executada'}`).join(' · ')}`
            : ''
          setLastMsg({ ok: false, text: `${data.erro ?? 'Erro desconhecido'}${fontesResumo}` })
        }
      } catch {
        setLastMsg({ ok: false, text: 'Erro ao conectar com a API' })
      }
    })
  }

  const inputCls = 'rounded-xl border border-[#E2DDD8] bg-[#F3F1EE] px-3 py-2 text-[13px] focus:outline-none focus:border-[#0F3D3E] focus:bg-white transition-colors w-full'

  return (
    <div className="space-y-5 max-w-6xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-[#0f1923] tracking-tight">Monitoramento</h1>
          <p className="text-[13px] text-[#9aabb8] mt-0.5">Publicações, intimações e prazos monitorados automaticamente</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/publicacoes"
            className="flex items-center gap-1.5 text-[12px] font-medium text-[#0F3D3E] border border-[#E2DDD8] px-3 py-2 rounded-xl hover:bg-[#F0F6F6] transition-colors"
          >
            <ExternalLink size={12} /> Publicações gerais
          </Link>
          <button
            onClick={() => triggerSearch()}
            disabled={searching}
            className="flex items-center gap-2 px-4 py-2 bg-[#1D5F60] hover:bg-[#27777A] text-white text-[13px] font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-60"
          >
            {searching
              ? <><RefreshCw size={13} className="animate-spin" /> Buscando…</>
              : <><Play size={13} /> Buscar agora</>}
          </button>
        </div>
      </div>

      {/* ── Last result feedback ── */}
      {lastMsg && (
        <div className={cn(
          'flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] font-medium border',
          lastMsg.ok
            ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
            : 'bg-red-50 border-red-100 text-red-700'
        )}>
          {lastMsg.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {lastMsg.text}
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Advogados ativos',  value: advogados.filter(a => a.ativo).length, bg: 'bg-white',       text: 'text-[#0f1923]' },
          { label: 'Novas',             value: totalNovas,    bg: 'bg-amber-50',    text: 'text-amber-700', onClick: () => { setTab('publicacoes'); setFStatus('nova'); resetPage() } },
          { label: 'Com prazo',         value: totalPrazo,    bg: 'bg-orange-50',   text: 'text-orange-700', onClick: () => { setTab('publicacoes'); setFStatus('nova'); setFPrazo(true); resetPage() } },
          { label: 'Com audiência',     value: totalAud,      bg: 'bg-rose-50',     text: 'text-rose-700',   onClick: () => { setTab('publicacoes'); setFStatus('nova'); setFAudiencia(true); resetPage() } },
        ].map(({ label, value, bg, text, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className={cn('rounded-lg border border-[#E2DDD8] shadow-sm p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all duration-150', bg)}
          >
            <p className={cn('text-[28px] font-black leading-none', text)}>{value}</p>
            <p className="text-[11px] text-[#9aabb8] mt-1.5 font-medium">{label}</p>
          </button>
        ))}
      </div>

      {/* ── Monitoring sources ── */}
      <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F0F6F6] flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-bold text-[#0f1923]">Fontes de monitoramento</h2>
            <p className="text-[12px] text-[#9aabb8] mt-0.5">
              Cada fonte informa o status real. Apenas fontes ativas executam captura agora.
            </p>
          </div>
          <span className="text-[11px] font-medium text-[#7a8899] whitespace-nowrap">
            {fontes.filter(f => f.status === 'ativo').length} ativa(s)
          </span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#F0F6F6] max-h-[520px] overflow-y-auto">
          {fontes.map(fonte => {
            const cfg = FONTE_STATUS_CFG[fonte.status]
            const podeExecutar = fonte.status === 'ativo'

            return (
              <div key={fonte.id} className="p-4 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[#0f1923] truncate">{fonte.nome}</p>
                    <p className="text-[11px] text-[#9aabb8] mt-0.5">
                      {fonte.tribunal} · {fonte.ramo}
                    </p>
                  </div>
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap', cfg.bg, cfg.text, cfg.border)}>
                    {cfg.label}
                  </span>
                </div>
                <p className="text-[11px] text-[#7a8899] leading-relaxed mt-2 line-clamp-2">
                  {fonte.descricao}
                </p>
                <div className="flex items-center justify-between gap-3 mt-3">
                  <p className="text-[10px] text-[#9aabb8]">
                    Última execução: {fonte.ultima_execucao ? timeAgo(fonte.ultima_execucao) : '—'}
                  </p>
                  <button
                    onClick={() => triggerSearch(fonte.id)}
                    disabled={searching || !podeExecutar}
                    className={cn(
                      'text-[11px] font-semibold px-3 py-1.5 rounded-xl transition-colors',
                      podeExecutar
                        ? 'bg-[#1D5F60] text-white hover:bg-[#27777A] disabled:opacity-60'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed',
                    )}
                  >
                    Executar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-[#E2DDD8]">
        {([
          { key: 'publicacoes', label: 'Publicações monitoradas', icon: FileText },
          { key: 'advogados',   label: 'Advogados monitorados',   icon: Users },
          { key: 'logs',        label: 'Histórico de execuções',  icon: Clock },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 px-5 py-3 text-[13px] font-medium border-b-2 transition-colors',
              tab === key
                ? 'border-[#0F3D3E] text-[#0F3D3E]'
                : 'border-transparent text-[#7a8899] hover:text-[#0f1923]'
            )}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* ══ Tab: Publicações ══════════════════════════════════════════════════ */}
      {tab === 'publicacoes' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm px-5 py-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Busca */}
              <div className="relative flex-1 min-w-[180px] max-w-sm">
                <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aabb8]" />
                <input
                  placeholder="Buscar texto, processo, nome…"
                  value={fBusca}
                  onChange={e => { setFBusca(e.target.value); resetPage() }}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[#E2DDD8] bg-[#F3F1EE] text-[13px] placeholder:text-[#9aabb8] focus:outline-none focus:border-[#0F3D3E] transition-colors"
                />
              </div>

              {/* Advogado */}
              <select
                value={fAdvogado}
                onChange={e => { setFAdvogado(e.target.value); resetPage() }}
                className="rounded-xl border border-[#E2DDD8] bg-white px-3 py-2 text-[13px] text-[#4a5a6a] focus:outline-none focus:border-[#0F3D3E] max-w-[220px]"
              >
                <option value="">Todos os advogados</option>
                {advogados.map(a => (
                  <option key={a.id} value={a.id}>{a.nome_completo} — OAB/{a.oab_uf} {a.oab_numero}</option>
                ))}
              </select>

              {/* Tribunal */}
              <select
                value={fTribunal}
                onChange={e => { setFTribunal(e.target.value); resetPage() }}
                className="rounded-xl border border-[#E2DDD8] bg-white px-3 py-2 text-[13px] text-[#4a5a6a] focus:outline-none focus:border-[#0F3D3E]"
              >
                <option value="">Todos os tribunais</option>
                {tribunais.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-[#F0F6F6]">
              {/* Status tabs */}
              <div className="flex bg-[#F0F6F6] rounded-xl p-1 gap-0.5">
                {[
                  { v: 'nova',       l: 'Novas'      },
                  { v: 'tratada',    l: 'Tratadas'   },
                  { v: 'descartada', l: 'Descartadas'},
                  { v: 'todos',      l: 'Todas'      },
                ].map(({ v, l }) => (
                  <button key={v} onClick={() => { setFStatus(v); resetPage() }}
                    className={cn('px-3 py-1 rounded-lg text-[12px] font-medium transition-colors whitespace-nowrap',
                      fStatus === v ? 'bg-white text-[#0f1923] shadow-sm' : 'text-[#7a8899] hover:text-[#0f1923]')}>
                    {l}
                  </button>
                ))}
              </div>

              <button onClick={() => { setFPrazo(f => !f); resetPage() }}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-medium transition-colors',
                  fPrazo ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-[#E2DDD8] text-[#7a8899] hover:border-[#c8d8d8]')}>
                <AlertTriangle size={11} /> Com prazo
              </button>
              <button onClick={() => { setFAudiencia(f => !f); resetPage() }}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-medium transition-colors',
                  fAudiencia ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-[#E2DDD8] text-[#7a8899] hover:border-[#c8d8d8]')}>
                <Gavel size={11} /> Com audiência
              </button>

              <div className="flex items-center gap-2 ml-auto">
                <input type="date" value={fDe} onChange={e => { setFDe(e.target.value); resetPage() }}
                  className="rounded-xl border border-[#E2DDD8] bg-white px-3 py-1.5 text-[12px] text-[#4a5a6a] focus:outline-none focus:border-[#0F3D3E]" />
                <span className="text-[11px] text-[#9aabb8]">até</span>
                <input type="date" value={fAte} onChange={e => { setFAte(e.target.value); resetPage() }}
                  className="rounded-xl border border-[#E2DDD8] bg-white px-3 py-1.5 text-[12px] text-[#4a5a6a] focus:outline-none focus:border-[#0F3D3E]" />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_120px_130px_100px_90px_120px] gap-3 px-5 py-3 border-b border-[#F0F6F6] bg-[#FAFCFC]">
              {['Publicação', 'Tribunal', 'Advogado/OAB', 'Data', 'Critério', 'Status'].map(h => (
                <p key={h} className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-wide">{h}</p>
              ))}
            </div>

            {paginated.length === 0 ? (
              <div className="py-16 text-center">
                <BarChart2 size={28} className="text-[#c8d8d8] mx-auto mb-3" />
                <p className="text-[14px] font-medium text-[#7a8899]">
                  {pubs.length === 0 ? 'Nenhuma publicação capturada ainda' : 'Nenhum resultado com esses filtros'}
                </p>
                <p className="text-[12px] text-[#9aabb8] mt-1">
                  {pubs.length === 0
                    ? 'Clique em "Buscar agora" para iniciar a captura automática'
                    : 'Tente ajustar os filtros'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#f5f7fa]">
                {paginated.map(pub => {
                  const tipoCfg  = TIPO_CFG[tipoDaPublicacao(pub)] ?? TIPO_CFG.outro
                  const origemCfg = ORIGEM_CFG[pub.origem] ?? { label: pub.origem, color: 'text-slate-500' }
                  const status = statusDaPublicacao(pub)
                  const texto = textoDaPublicacao(pub)

                  return (
                    <div
                      key={pub.id}
                      onClick={() => setExpanded(pub)}
                      className={cn(
                        'grid grid-cols-[1fr_120px_130px_100px_90px_120px] gap-3 px-5 py-3.5 hover:bg-[#f9fafb] cursor-pointer transition-colors items-center',
                        status === 'nova' && 'bg-amber-50/20',
                        status === 'descartada' && 'opacity-50',
                      )}
                    >
                      {/* Title + badges */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', tipoCfg.bg, tipoCfg.text)}>
                            {tipoCfg.label}
                          </span>
                          {pub.prazo_detectado && <AlertTriangle size={11} className="text-orange-500 flex-shrink-0" />}
                          {pub.audiencia_detectada && <Gavel size={11} className="text-rose-500 flex-shrink-0" />}
                        </div>
                        <p className="text-[13px] font-medium text-[#0f1923] truncate leading-tight">
                          {texto.slice(0, 80) || '(sem texto)'}
                        </p>
                        {pub.numero_processo && (
                          <p className="text-[10px] font-mono text-[#9aabb8] truncate">{pub.numero_processo}</p>
                        )}
                      </div>

                      {/* Tribunal */}
                      <p className="text-[12px] text-[#4a5a6a] truncate">{pub.tribunal ?? '—'}</p>

                      {/* Advogado */}
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-[#0f1923] truncate">
                          {pub.advogado?.nome_completo ?? pub.nome_pesquisado}
                        </p>
                        {pub.oab_pesquisada && (
                          <p className="text-[10px] text-[#9aabb8]">OAB/{pub.oab_pesquisada}</p>
                        )}
                      </div>

                      {/* Data */}
                      <p className="text-[12px] text-[#7a8899]">{fmt(pub.data_publicacao)}</p>

                      {/* Critério */}
                      <p className={cn('text-[11px] font-medium truncate', origemCfg.color)}>
                        {origemCfg.label}
                      </p>

                      {/* Status */}
                      <div onClick={e => e.stopPropagation()}>
                        <StatusPill
                          status={status}
                          onChange={s => handleStatusChange(pub.id, s)}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#F0F6F6]">
                <p className="text-[12px] text-[#9aabb8]">
                  {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#E2DDD8] disabled:opacity-30 hover:bg-[#F0F6F6] transition-colors">
                    <ChevronLeft size={13} />
                  </button>
                  <span className="text-[12px] text-[#4a5a6a] px-2">{page} / {totalPages}</span>
                  <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#E2DDD8] disabled:opacity-30 hover:bg-[#F0F6F6] transition-colors">
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Tab: Advogados ════════════════════════════════════════════════════ */}
      {tab === 'advogados' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F6F6]">
              <div>
                <h2 className="text-[14px] font-bold text-[#0f1923]">Advogados monitorados</h2>
                <p className="text-[12px] text-[#9aabb8] mt-0.5">
                  A busca usa sempre o nome completo exato e a OAB exata
                </p>
              </div>
              <button onClick={() => setAdding(a => !a)} className="text-[12px] font-semibold text-[#0F3D3E] hover:text-[#1D5F60]">
                + Adicionar
              </button>
            </div>

            {adding && (
              <div className="px-5 py-4 bg-[#F3F1EE] border-b border-[#F0F6F6] space-y-2.5">
                <input
                  className={inputCls}
                  placeholder="NOME COMPLETO (ex: CRISTIANO PESSOA SOUSA)"
                  value={form.nome_completo}
                  onChange={e => setForm(f => ({ ...f, nome_completo: e.target.value }))}
                />
                <div className="flex gap-2">
                  <input className={cn(inputCls, 'flex-1')} placeholder="Número OAB (ex: 88465)"
                    value={form.oab_numero} onChange={e => setForm(f => ({ ...f, oab_numero: e.target.value }))} />
                  <input className={cn(inputCls, 'w-20')} placeholder="UF" maxLength={2}
                    value={form.oab_uf} onChange={e => setForm(f => ({ ...f, oab_uf: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setAdding(false)} className="flex-1 py-2 rounded-xl border border-[#E2DDD8] text-[12px] text-[#7a8899] hover:bg-[#F0F6F6]">Cancelar</button>
                  <button onClick={handleAdd} disabled={saving} className="flex-1 py-2 rounded-xl bg-[#1D5F60] text-white text-[12px] font-semibold disabled:opacity-40">
                    {saving ? 'Salvando…' : 'Adicionar'}
                  </button>
                </div>
              </div>
            )}

            <div className="divide-y divide-[#f5f7fa]">
              {advogados.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-[13px] text-[#9aabb8]">Nenhum advogado cadastrado</p>
                </div>
              ) : advogados.map(adv => (
                <div key={adv.id} className="flex items-center gap-4 px-5 py-4">
                  <div className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-0.5', adv.ativo ? 'bg-emerald-400' : 'bg-slate-300')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0f1923]">{adv.nome_completo}</p>
                    <p className="text-[12px] text-[#9aabb8]">OAB/{adv.oab_uf} {adv.oab_numero}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-[#9aabb8]">
                      {pubs.filter(p => p.advogado_monitorado_id === adv.id).length} publicações
                    </p>
                    <p className="text-[10px] text-[#c8d8d8]">capturadas</p>
                  </div>
                  <button
                    onClick={() => toggleAtivo(adv.id, adv.ativo)}
                    className={cn('text-[11px] font-medium px-3 py-1.5 rounded-full transition-colors',
                      adv.ativo ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}
                  >
                    {adv.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Cron info */}
          <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm px-5 py-4">
            <p className="text-[12px] font-semibold text-[#0f1923] mb-2">Automação via cron</p>
            <p className="text-[12px] text-[#7a8899] leading-relaxed mb-3">
              Configure um cron job externo (Vercel Cron, Railway, GitHub Actions) para executar automaticamente:
            </p>
            <div className="bg-[#F3F1EE] rounded-xl p-3 font-mono text-[11px] text-[#4a5a6a] border border-[#E2DDD8] space-y-1">
              <p>POST {typeof window !== 'undefined' ? window.location.origin : ''}/api/monitoramento/buscar</p>
              <p className="text-[#9aabb8]">Authorization: Bearer {'{'}{'{'}CRON_SECRET{'}'}{'}'}</p>
            </div>
            <p className="text-[11px] text-[#9aabb8] mt-2">
              Defina <code className="bg-[#F3F1EE] px-1 rounded">CRON_SECRET</code> no <code className="bg-[#F3F1EE] px-1 rounded">.env.local</code> para proteger o endpoint.
            </p>
          </div>
        </div>
      )}

      {/* ══ Tab: Logs ════════════════════════════════════════════════════════ */}
      {tab === 'logs' && (
        <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0F6F6]">
            <h2 className="text-[14px] font-bold text-[#0f1923]">Histórico de execuções</h2>
            <p className="text-[12px] text-[#9aabb8] mt-0.5">Registros de cada busca realizada</p>
          </div>
          {logs.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Clock size={28} className="text-[#c8d8d8] mx-auto mb-3" />
              <p className="text-[13px] text-[#9aabb8]">Nenhuma execução registrada</p>
              <p className="text-[12px] text-[#c8d8d8] mt-1">Clique em "Buscar agora" para iniciar</p>
            </div>
          ) : (
            <div className="divide-y divide-[#f5f7fa]">
              {logs.map(log => (
                <div key={log.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[13px] font-semibold text-[#0f1923]">{timeAgo(log.executado_em)}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#9aabb8]">{fmt(log.executado_em)}</span>
                      <span className={cn(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                        log.disparado_por === 'cron' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                      )}>
                        {log.disparado_por}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[12px] text-[#7a8899] flex-wrap">
                    <span>{log.total_advogados} advogado(s)</span>
                    <span>{log.total_pesquisas} pesquisas</span>
                    <span>{log.total_encontradas} encontradas</span>
                    <span className="font-semibold text-emerald-600">{log.total_novas} novas</span>
                    <span>{log.total_duplicadas} duplicadas</span>
                    {log.duracao_ms && <span className="text-[#9aabb8]">{(log.duracao_ms / 1000).toFixed(1)}s</span>}
                  </div>
                  {log.erro && (
                    <p className="text-[11px] text-red-500 mt-1.5 truncate">{log.erro}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Detail modal ── */}
      {expanded && (
        <DetalheModal
          pub={expanded}
          onClose={() => setExpanded(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}
