'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import ProvidenciaModal from '@/components/kanban/ProvidenciaModal'
import { createClient } from '@/lib/supabase/client'
import {
  AlertTriangle, CheckCircle2, XCircle, Search,
  ChevronDown, ChevronLeft, ChevronRight, Upload, Plus,
  Gavel, FileText, ExternalLink, Link2, Clock, X, Sparkles,
  Zap, Target, Play, Pause, TrendingUp, CalendarDays, Scale,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx'
import {
  detectarPrazosEAudiencias,
  detectarTipoResultado,
  type DetectionResult,
} from '@/lib/monitoramento/prazo-detector'
import { calcularPrazoFinal } from '@/lib/monitoramento/prazo-util'

// ─── Types ────────────────────────────────────────────────────────────────────

type Prioridade = 'critica' | 'alta' | 'media' | 'baixa'

interface Publicacao {
  id: string
  numero_processo?: string
  processo_id?: string
  tribunal?: string
  orgao?: string
  data_publicacao?: string
  data_disponibilizacao?: string
  nome_pesquisado: string
  texto_publicacao?: string
  resumo?: string
  tipo_publicacao: string
  prazo_detectado: boolean
  prazo_dias?: number
  prazo_data?: string
  prazo_descricao?: string
  audiencia_detectada: boolean
  audiencia_data?: string
  audiencia_descricao?: string
  status: 'nao_tratada' | 'tratada' | 'descartada'
  origem: string
  oab_pesquisada?: string
  hash: string
  created_at: string
  tratado_em?: string
  acao_tomada?: string
  processo?: { id: string; titulo: string; numero_processo?: string } | null
}

interface Processo { id: string; titulo: string; numero_processo?: string }
interface Advogado { id: string; nome_completo: string; oab_numero: string; oab_uf: string }

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  nao_tratada: { label: 'Não tratada', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',  dot: 'bg-amber-400'  },
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

const PRIORIDADE_CFG: Record<Prioridade, {
  label: string; bar: string; bg: string; text: string; border: string; dot: string; order: number
}> = {
  critica: { label: 'Crítica', bar: 'bg-red-500',    bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500',    order: 0 },
  alta:    { label: 'Alta',    bar: 'bg-orange-400', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-400', order: 1 },
  media:   { label: 'Média',   bar: 'bg-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-400', order: 2 },
  baixa:   { label: 'Baixa',   bar: 'bg-slate-300',  bg: 'bg-slate-50',  text: 'text-slate-500',  border: 'border-slate-200',  dot: 'bg-slate-300',  order: 3 },
}

const PAGE_SIZE = 20

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso?: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function todayISO() { return new Date().toISOString().slice(0, 10) }

function hashStr(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i), h = h >>> 0
  return h.toString(16).padStart(8, '0')
}

function diffDays(isoA: string, isoB: string): number {
  return Math.ceil((new Date(isoA).getTime() - new Date(isoB).getTime()) / 86400000)
}

function calcPrioridade(pub: Publicacao, today: string): Prioridade {
  if (pub.status !== 'nao_tratada') return 'baixa'

  const prazoDate = pub.prazo_data
  const audDate   = pub.audiencia_data

  // Crítica: prazo hoje ou vencido
  if (prazoDate && prazoDate <= today) return 'critica'
  if (audDate  && audDate  <= today)   return 'critica'

  // Alta: prazo ou audiência em até 3 dias
  if (prazoDate && diffDays(prazoDate, today) <= 3) return 'alta'
  if (audDate   && diffDays(audDate, today)   <= 3) return 'alta'

  // Média: prazo ou audiência detectados (sem data concreta ou > 3 dias)
  if (pub.prazo_detectado || pub.audiencia_detectada) return 'media'

  return 'baixa'
}

function sugestaoAcao(pub: Publicacao): { acao: string; confianca: number; tipo: 'prazo' | 'tarefa' | 'vincular' | 'revisar' } {
  const texto = (pub.texto_publicacao ?? '').toLowerCase()

  if (pub.prazo_detectado && pub.prazo_data) {
    return { acao: 'Criar prazo na agenda', confianca: 95, tipo: 'prazo' }
  }
  if (pub.prazo_detectado) {
    return { acao: 'Criar prazo urgente', confianca: 82, tipo: 'prazo' }
  }
  if (pub.audiencia_detectada) {
    return { acao: 'Agendar audiência', confianca: 90, tipo: 'tarefa' }
  }
  if (!pub.processo_id && pub.numero_processo) {
    return { acao: 'Vincular processo', confianca: 78, tipo: 'vincular' }
  }
  if (pub.tipo_publicacao === 'sentenca' || texto.includes('sentença') || texto.includes('condena')) {
    return { acao: 'Revisar sentença', confianca: 72, tipo: 'tarefa' }
  }
  if (pub.tipo_publicacao === 'intimacao' || texto.includes('intime-se') || texto.includes('intimação')) {
    return { acao: 'Criar tarefa de resposta', confianca: 65, tipo: 'tarefa' }
  }
  if (texto.includes('recurso') || texto.includes('apelação') || texto.includes('agravo')) {
    return { acao: 'Analisar recurso', confianca: 60, tipo: 'tarefa' }
  }
  return { acao: 'Revisar publicação', confianca: 40, tipo: 'revisar' }
}

// ─── Status dropdown ──────────────────────────────────────────────────────────

function StatusPill({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false)
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.nao_tratada

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap',
          cfg.bg, cfg.text, cfg.border
        )}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
        {cfg.label}
        <ChevronDown size={9} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 z-30 bg-white rounded-xl shadow-lg border border-[#E8F0F0] py-1 min-w-[140px]">
          {Object.entries(STATUS_CFG).map(([k, v]) => (
            <button
              key={k}
              onClick={() => { onChange(k); setOpen(false) }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[#F7F9F9] text-left',
                k === status ? `${v.text} font-semibold` : 'text-[#4a5a6a]'
              )}
            >
              <span className={cn('w-2 h-2 rounded-full', v.dot)} /> {v.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Priority badge ───────────────────────────────────────────────────────────

function PrioridadeBadge({ prioridade }: { prioridade: Prioridade }) {
  const cfg = PRIORIDADE_CFG[prioridade]
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border',
      cfg.bg, cfg.text, cfg.border
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

// ─── Smart suggestion chip ────────────────────────────────────────────────────

function SugestaoChip({
  pub, onClick,
}: { pub: Publicacao; onClick: (tipo: 'prazo' | 'tarefa' | 'vincular' | 'revisar') => void }) {
  const s = sugestaoAcao(pub)
  if (s.confianca < 50) return null
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(s.tipo) }}
      className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors whitespace-nowrap"
      title={`Sugestão automática (${s.confianca}% confiança)`}
    >
      <Sparkles size={9} />
      {s.acao}
      <span className="text-violet-400 font-normal">{s.confianca}%</span>
    </button>
  )
}

// ─── Quick actions bar ────────────────────────────────────────────────────────

function QuickActions({
  pub, processos, onStatusChange, onVincular, onCreateAgenda, onExpand,
}: {
  pub: Publicacao
  processos: Processo[]
  onStatusChange: (id: string, s: string) => void
  onVincular: (id: string, processoId: string) => Promise<void>
  onCreateAgenda: (pub: Publicacao, tipo: 'tarefa' | 'prazo') => void
  onExpand: () => void
}) {
  const [showVincular, setShowVincular] = useState(false)
  const [processoSel, setProcessoSel]   = useState(pub.processo_id ?? '')
  const [saving,      setSaving]        = useState(false)

  async function vincular() {
    if (!processoSel) return
    setSaving(true)
    await onVincular(pub.id, processoSel)
    setSaving(false)
    setShowVincular(false)
  }

  if (showVincular) {
    return (
      <div
        className="flex items-center gap-2 flex-wrap"
        onClick={e => e.stopPropagation()}
      >
        <select
          value={processoSel}
          onChange={e => setProcessoSel(e.target.value)}
          className="text-[11px] rounded-lg border border-[#D0DCDC] bg-white px-2 py-1 focus:outline-none focus:border-[#0F3D3E] max-w-[180px]"
          autoFocus
        >
          <option value="">— Selecione —</option>
          {processos.map(p => (
            <option key={p.id} value={p.id}>{p.titulo}</option>
          ))}
        </select>
        <button
          onClick={vincular}
          disabled={!processoSel || saving}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#0F3D3E] text-white hover:bg-[#145A5B] disabled:opacity-40"
        >
          {saving ? '…' : 'Ok'}
        </button>
        <button
          onClick={() => setShowVincular(false)}
          className="text-[11px] px-2 py-1 text-[#9aabb8] hover:text-[#4a5a6a]"
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 flex-wrap" onClick={e => e.stopPropagation()}>
      {pub.status === 'nao_tratada' && (
        <>
          {pub.prazo_detectado && (
            <button
              onClick={() => onCreateAgenda(pub, 'prazo')}
              className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition-colors"
            >
              <AlertTriangle size={10} /> Prazo
            </button>
          )}
          <button
            onClick={() => onCreateAgenda(pub, 'tarefa')}
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-[#F0F6F6] text-[#0F3D3E] border border-[#D0DCDC] hover:bg-[#e0ecec] transition-colors"
          >
            <Plus size={10} /> Tarefa
          </button>
          {!pub.processo_id && (
            <button
              onClick={() => setShowVincular(true)}
              className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-[#F7F9F9] text-[#4a5a6a] border border-[#D0DCDC] hover:bg-[#F0F6F6] transition-colors"
            >
              <Link2 size={10} /> Vincular
            </button>
          )}
          <button
            onClick={() => onStatusChange(pub.id, 'tratada')}
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
          >
            <CheckCircle2 size={10} /> Tratar
          </button>
          <button
            onClick={() => onStatusChange(pub.id, 'descartada')}
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 transition-colors"
          >
            <XCircle size={10} /> Descartar
          </button>
        </>
      )}
      {pub.status !== 'nao_tratada' && (
        <button
          onClick={() => onStatusChange(pub.id, 'nao_tratada')}
          className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
        >
          Reabrir
        </button>
      )}
      <button
        onClick={onExpand}
        className="flex items-center gap-1 text-[11px] text-[#9aabb8] hover:text-[#4a5a6a] px-1"
      >
        <ExternalLink size={10} />
      </button>
    </div>
  )
}

// ─── Sugestão de prazo intercept modal ───────────────────────────────────────

function SugestaoPrazoModal({
  pub, processos,
  onCriarPrazo, onCriarTarefa, onPular, onCancelar,
}: {
  pub: Publicacao
  processos: Processo[]
  onCriarPrazo: () => void
  onCriarTarefa: () => void
  onPular: () => void
  onCancelar: () => void
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onCancelar}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-orange-500 to-amber-400 rounded-t-2xl px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} className="text-white" />
            </div>
            <div>
              <p className="text-[15px] font-bold">Prazo detectado nesta publicação</p>
              <p className="text-[12px] text-white/75 mt-0.5">Deseja criar um item na agenda antes de marcar como tratada?</p>
            </div>
          </div>
          <div className="mt-3 bg-white/15 rounded-xl px-4 py-3 space-y-1">
            {pub.prazo_dias && (
              <p className="text-[13px] font-semibold">
                Prazo: {pub.prazo_dias} dias{pub.prazo_data && ` · até ${pub.prazo_data.split('-').reverse().join('/')}`}
              </p>
            )}
            {!pub.prazo_dias && pub.prazo_data && (
              <p className="text-[13px] font-semibold">Data limite: {pub.prazo_data.split('-').reverse().join('/')}</p>
            )}
            {pub.prazo_descricao && (
              <p className="text-[11px] text-white/80 leading-relaxed line-clamp-2">{pub.prazo_descricao}</p>
            )}
            {!pub.prazo_dias && !pub.prazo_data && !pub.prazo_descricao && (
              <p className="text-[12px] text-white/80">Menção a prazo encontrada no texto</p>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-b border-[#F0F6F6]">
          <p className="text-[12px] text-[#7a8899]">
            <span className="font-medium text-[#0f1923]">{pub.tribunal ?? 'Tribunal'}</span>
            {pub.numero_processo && <span className="ml-1 font-mono text-[11px]">· {pub.numero_processo}</span>}
          </p>
          {pub.processo && <p className="text-[11px] text-[#9aabb8] mt-0.5">{pub.processo.titulo}</p>}
        </div>
        <div className="px-6 py-5 space-y-2">
          <button onClick={onCriarPrazo} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0F3D3E] hover:bg-[#145A5B] text-white text-[13px] font-bold transition-colors shadow-sm">
            <Plus size={14} /> Criar prazo na agenda
          </button>
          <button onClick={onCriarTarefa} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#D0DCDC] text-[#4a5a6a] text-[13px] font-medium hover:bg-[#F7F9F9] transition-colors">
            <CheckCircle2 size={13} /> Criar tarefa na agenda
          </button>
          <div className="flex gap-2 pt-1">
            <button onClick={onPular} className="flex-1 py-2 text-[12px] text-[#9aabb8] hover:text-[#4a5a6a] transition-colors">Marcar como tratada sem criar</button>
            <button onClick={onCancelar} className="flex-1 py-2 text-[12px] text-[#9aabb8] hover:text-[#4a5a6a] transition-colors">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Publication detail modal ─────────────────────────────────────────────────

function PublicacaoModal({
  pub, processos, feriados, onClose, onStatusChange, onVincular, onCreateAgenda, onKanban,
}: {
  pub: Publicacao
  processos: Processo[]
  feriados: string[]
  onClose: () => void
  onStatusChange: (id: string, s: string) => void
  onVincular: (id: string, processoId: string) => Promise<void>
  onCreateAgenda: (pub: Publicacao, tipo: 'tarefa' | 'prazo') => void
  onKanban: (pub: Publicacao) => void
}) {
  const [vinculando,          setVinculando]          = useState(false)
  const [processoSelecionado, setProcessoSelecionado]  = useState(pub.processo_id ?? '')
  const [salvando,            setSalvando]             = useState(false)
  const [showGerarPrazo,      setShowGerarPrazo]       = useState(false)
  const [analise,             setAnalise]              = useState<DetectionResult | null>(null)
  const [dataSugerida,        setDataSugerida]         = useState('')
  const [tipoSugerido,        setTipoSugerido]         = useState('')

  const today    = todayISO()
  const prio     = calcPrioridade(pub, today)
  const prioCfg  = PRIORIDADE_CFG[prio]
  const tipo     = TIPO_CFG[pub.tipo_publicacao] ?? TIPO_CFG.outro

  async function salvarVinculo() {
    if (!processoSelecionado) return
    setSaving(true)
    await onVincular(pub.id, processoSelecionado)
    setVinculando(false)
    setSalvando(false)
  }

  function setSaving(v: boolean) { setSalvando(v) }

  function analisarTexto() {
    if (!pub.texto_publicacao) { setAnalise({ prazo_detectado: false, audiencia_detectada: false }); setShowGerarPrazo(true); return }
    const resultado     = detectarPrazosEAudiencias(pub.texto_publicacao)
    const tipoDetectado = detectarTipoResultado(pub.texto_publicacao)

    // Calcula data de vencimento usando prazo útil real (com feriados)
    let data = resultado.prazo_data ?? ''
    if (!data && resultado.prazo_dias) {
      const dataBase = pub.data_publicacao ?? today
      const { dataFinal } = calcularPrazoFinal(dataBase, resultado.prazo_dias, 'uteis', feriados)
      data = dataFinal
    }
    if (!data) data = today

    setAnalise(resultado)
    setDataSugerida(data)
    setTipoSugerido(tipoDetectado)
    setShowGerarPrazo(true)
  }

  function confirmarPrazo() {
    const pubEnriquecida: Publicacao = {
      ...pub,
      prazo_detectado:  true,
      prazo_dias:       analise?.prazo_dias ?? undefined,
      prazo_data:       dataSugerida || undefined,
      prazo_descricao:  analise?.prazo_descricao ?? tipoSugerido,
    }
    setShowGerarPrazo(false)
    onCreateAgenda(pubEnriquecida, 'prazo')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* Priority bar */}
        <div className={cn('h-1 w-full rounded-t-2xl', prioCfg.bar)} />

        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-5 pb-4 border-b border-[#F0F6F6]">
          <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 mt-0.5', tipo.bg, tipo.text)}>
            {tipo.label}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-[#0f1923]">
              {pub.tribunal ?? 'Tribunal não informado'}
              {pub.numero_processo && <span className="ml-2 font-mono font-normal text-[12px] text-[#7a8899]">{pub.numero_processo}</span>}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[12px] text-[#9aabb8]">{fmt(pub.data_publicacao)}</p>
              {pub.status === 'nao_tratada' && <PrioridadeBadge prioridade={prio} />}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#F0F6F6] text-[#9aabb8] transition-colors flex-shrink-0">
            <X size={15} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Prazo / Audiência alerts */}
          {(pub.prazo_detectado || pub.audiencia_detectada) && (
            <div className="space-y-2">
              {pub.prazo_detectado && (
                <div className="p-3.5 bg-orange-50 rounded-xl border border-orange-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={15} className="text-orange-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-orange-700">Prazo detectado</p>
                      {pub.prazo_dias && <p className="text-[12px] text-orange-600 mt-0.5">{pub.prazo_dias} dias{pub.prazo_data ? ` · até ${fmt(pub.prazo_data)}` : ''}</p>}
                      {!pub.prazo_dias && pub.prazo_data && <p className="text-[12px] text-orange-600 mt-0.5">Data limite: {fmt(pub.prazo_data)}</p>}
                      {pub.prazo_descricao && <p className="text-[11px] text-orange-500 mt-1 leading-relaxed line-clamp-2">{pub.prazo_descricao}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-orange-100">
                    <button onClick={() => onCreateAgenda(pub, 'prazo')} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-semibold transition-colors">
                      <Plus size={11} /> Criar prazo na agenda
                    </button>
                    <button onClick={() => onCreateAgenda(pub, 'tarefa')} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-orange-200 text-orange-700 text-[12px] font-medium hover:bg-orange-100 transition-colors">
                      <CheckCircle2 size={11} /> Criar tarefa
                    </button>
                  </div>
                </div>
              )}
              {pub.audiencia_detectada && (
                <div className="flex gap-3 p-3.5 bg-rose-50 rounded-xl border border-rose-100">
                  <Gavel size={15} className="text-rose-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] font-semibold text-rose-700">Audiência detectada</p>
                    {pub.audiencia_data && <p className="text-[12px] text-rose-600">Data: {fmt(pub.audiencia_data)}</p>}
                    {pub.audiencia_descricao && <p className="text-[11px] text-rose-500 mt-1 leading-relaxed">{pub.audiencia_descricao}</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Smart suggestion */}
          {pub.status === 'nao_tratada' && (() => {
            const s = sugestaoAcao(pub)
            return s.confianca >= 55 ? (
              <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-xl border border-violet-100">
                <Sparkles size={14} className="text-violet-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-violet-700">{s.acao}</p>
                  <p className="text-[11px] text-violet-500">Sugestão automática · {s.confianca}% de confiança</p>
                </div>
                <button
                  onClick={() => s.tipo === 'prazo' || s.tipo === 'tarefa' ? onCreateAgenda(pub, s.tipo) : undefined}
                  className="text-[11px] font-semibold text-violet-700 border border-violet-200 px-2.5 py-1 rounded-lg hover:bg-violet-100 transition-colors whitespace-nowrap"
                >
                  Executar
                </button>
              </div>
            ) : null
          })()}

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-wide mb-1">Advogado/Nome pesquisado</p>
              <p className="text-[13px] text-[#0f1923] font-medium">{pub.nome_pesquisado}</p>
              {pub.oab_pesquisada && <p className="text-[11px] text-[#9aabb8]">OAB/{pub.oab_pesquisada}</p>}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-wide mb-1">Órgão</p>
              <p className="text-[13px] text-[#4a5a6a]">{pub.orgao ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-wide mb-1">Processo vinculado</p>
              {pub.processo
                ? <p className="text-[13px] text-[#145A5B] font-medium">{pub.processo.titulo}</p>
                : <p className="text-[12px] text-[#9aabb8]">Não vinculado</p>}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-wide mb-1">Origem</p>
              <p className="text-[12px] text-[#7a8899]">{pub.origem}</p>
            </div>
          </div>

          {/* Text */}
          {pub.texto_publicacao && (
            <div>
              <p className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-wide mb-2">Texto da publicação</p>
              <div className="bg-[#F7F9F9] rounded-xl p-4 text-[12px] text-[#4a5a6a] leading-relaxed font-mono whitespace-pre-wrap max-h-44 overflow-y-auto border border-[#E8F0F0]">
                {pub.texto_publicacao}
              </div>
            </div>
          )}

          {/* Vincular processo */}
          {vinculando ? (
            <div className="space-y-2 p-3 bg-[#F7F9F9] rounded-xl border border-[#E8F0F0]">
              <p className="text-[12px] font-semibold text-[#0f1923]">Vincular ao processo</p>
              <select
                value={processoSelecionado}
                onChange={e => setProcessoSelecionado(e.target.value)}
                className="w-full rounded-xl border border-[#D0DCDC] bg-white px-3 py-2 text-[13px] focus:outline-none focus:border-[#0F3D3E]"
              >
                <option value="">— Selecione um processo —</option>
                {processos.map(p => (
                  <option key={p.id} value={p.id}>{p.titulo}{p.numero_processo ? ` · ${p.numero_processo}` : ''}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button onClick={() => setVinculando(false)} className="flex-1 py-2 rounded-xl border border-[#D0DCDC] text-[12px] text-[#7a8899] hover:bg-[#F0F6F6]">Cancelar</button>
                <button onClick={salvarVinculo} disabled={!processoSelecionado || salvando} className="flex-1 py-2 rounded-xl bg-[#0F3D3E] text-white text-[12px] font-semibold hover:bg-[#145A5B] disabled:opacity-40">
                  {salvando ? 'Salvando…' : 'Vincular'}
                </button>
              </div>
            </div>
          ) : null}

          {/* Actions */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-wide">Ações</p>

            {/* Gerar prazo automaticamente */}
            {!showGerarPrazo && pub.texto_publicacao && (
              <button
                onClick={analisarTexto}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-[12px] font-semibold rounded-xl hover:bg-amber-100 transition-colors"
              >
                <CalendarDays size={13} /> Gerar prazo automaticamente
              </button>
            )}

            {/* Painel de confirmação de prazo */}
            {showGerarPrazo && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-bold text-amber-800 flex items-center gap-1.5">
                    <CalendarDays size={13} /> Análise automática do texto
                  </p>
                  <button onClick={() => setShowGerarPrazo(false)} className="text-amber-400 hover:text-amber-700"><X size={13} /></button>
                </div>
                {analise && !analise.prazo_detectado ? (
                  <p className="text-[12px] text-amber-700">Nenhum prazo identificado no texto. Você ainda pode criar um prazo manualmente.</p>
                ) : (
                  <>
                    {analise?.prazo_descricao && (
                      <p className="text-[11px] text-amber-600 leading-relaxed bg-white/70 rounded-lg px-3 py-2 border border-amber-100">
                        {analise.prazo_descricao}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">Tipo detectado</label>
                        <select
                          value={tipoSugerido}
                          onChange={e => setTipoSugerido(e.target.value)}
                          className="w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-[12px] text-[#0f1923] focus:outline-none focus:border-amber-400"
                        >
                          <option value="intimacao">Intimação</option>
                          <option value="despacho">Despacho</option>
                          <option value="sentenca">Sentença</option>
                          <option value="acordao">Acórdão</option>
                          <option value="publicacao">Publicação</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">
                          Data limite{analise?.prazo_dias ? ` (${analise.prazo_dias} dias)` : ''}
                        </label>
                        <input
                          type="date"
                          value={dataSugerida}
                          onChange={e => setDataSugerida(e.target.value)}
                          className="w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-[12px] text-[#0f1923] focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                  </>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setShowGerarPrazo(false)} className="flex-1 py-2 rounded-lg border border-amber-200 text-[12px] text-amber-700 hover:bg-amber-100 transition-colors">Cancelar</button>
                  <button
                    onClick={confirmarPrazo}
                    disabled={!dataSugerida && !!analise?.prazo_detectado}
                    className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[12px] font-semibold transition-colors disabled:opacity-40"
                  >
                    Confirmar e criar prazo
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button onClick={() => onCreateAgenda(pub, 'tarefa')} className="flex items-center gap-2 px-4 py-2.5 bg-[#0F3D3E] hover:bg-[#145A5B] text-white text-[12px] font-semibold rounded-xl transition-colors">
                <Plus size={12} /> Criar tarefa
              </button>
              <button onClick={() => onCreateAgenda(pub, 'prazo')} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-semibold rounded-xl transition-colors">
                <AlertTriangle size={12} /> Criar prazo
              </button>
              {!pub.processo_id && (
                <button onClick={() => setVinculando(true)} className="flex items-center gap-2 px-4 py-2.5 border border-[#D0DCDC] text-[#4a5a6a] text-[12px] font-medium rounded-xl hover:bg-[#F7F9F9] transition-colors">
                  <Link2 size={12} /> Vincular processo
                </button>
              )}
              <button onClick={() => { onStatusChange(pub.id, 'tratada'); onClose() }} className="flex items-center gap-2 px-4 py-2.5 border border-emerald-200 bg-emerald-50 text-emerald-700 text-[12px] font-medium rounded-xl hover:bg-emerald-100 transition-colors">
                <CheckCircle2 size={12} /> Marcar como tratada
              </button>
              <button onClick={() => onKanban(pub)} className="flex items-center gap-2 px-4 py-2.5 border border-violet-200 bg-violet-50 text-violet-700 text-[12px] font-medium rounded-xl hover:bg-violet-100 transition-colors">
                <FileText size={12} /> Enviar para Kanban
              </button>
              <button onClick={() => { onStatusChange(pub.id, 'descartada'); onClose() }} className="flex items-center gap-2 px-4 py-2.5 border border-[#D0DCDC] text-[#9aabb8] text-[12px] font-medium rounded-xl hover:bg-[#F7F9F9] transition-colors">
                <XCircle size={12} /> Descartar
              </button>
            </div>
          </div>

          {/* Status selector */}
          <div>
            <p className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-wide mb-2">Status</p>
            <div className="flex gap-2">
              {Object.entries(STATUS_CFG).map(([k, v]) => (
                <button key={k} onClick={() => onStatusChange(pub.id, k)}
                  className={cn('flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 text-[12px] font-semibold transition-all',
                    pub.status === k ? `${v.bg} ${v.text} ${v.border}` : 'border-[#E8F0F0] text-[#9aabb8] hover:border-[#c8d8d8]'
                  )}>
                  <span className={cn('w-2 h-2 rounded-full', v.dot)} /> {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* History */}
          <div>
            <p className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-wide mb-2">Histórico</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-[11px] text-[#7a8899]">
                <Clock size={11} className="flex-shrink-0" />
                <span>Adicionado ao sistema em {fmt(pub.created_at)}</span>
              </div>
              {pub.data_publicacao && (
                <div className="flex items-center gap-3 text-[11px] text-[#7a8899]">
                  <FileText size={11} className="flex-shrink-0" />
                  <span>Publicado em {fmt(pub.data_publicacao)}</span>
                </div>
              )}
              {pub.status === 'tratada' && pub.tratado_em && (
                <div className="flex items-center gap-3 text-[11px] text-emerald-600">
                  <CheckCircle2 size={11} className="flex-shrink-0" />
                  <span>Tratada em {fmt(pub.tratado_em)}{pub.acao_tomada ? ` · ${pub.acao_tomada}` : ''}</span>
                </div>
              )}
              {pub.status === 'tratada' && !pub.tratado_em && (
                <div className="flex items-center gap-3 text-[11px] text-emerald-600">
                  <CheckCircle2 size={11} className="flex-shrink-0" />
                  <span>Marcada como tratada</span>
                </div>
              )}
              {pub.status === 'descartada' && (
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <XCircle size={11} className="flex-shrink-0" />
                  <span>Descartada</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Import modal ─────────────────────────────────────────────────────────────

function ImportModal({
  onClose, onImport,
}: { onClose: () => void; onImport: (rows: Partial<Publicacao>[]) => Promise<void> }) {
  const fileRef    = useRef<HTMLInputElement>(null)
  const [rows,     setRows]    = useState<any[]>([])
  const [loading,  setLoading] = useState(false)
  const [imported, setImported] = useState(false)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const data = new Uint8Array(ev.target!.result as ArrayBuffer)
      const wb   = XLSX.read(data, { type: 'array' })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' })
      setRows(json as any[])
    }
    reader.readAsArrayBuffer(file)
  }

  async function doImport() {
    if (!rows.length) return
    setLoading(true)
    const parsed: Partial<Publicacao>[] = rows.map((r: any) => ({
      numero_processo:  String(r.numero_processo ?? r['Nº Processo'] ?? '').trim() || undefined,
      tribunal:         String(r.tribunal ?? r.Tribunal ?? '').trim() || undefined,
      data_publicacao:  String(r.data_publicacao ?? r['Data Publicação'] ?? '').trim() || undefined,
      nome_pesquisado:  String(r.nome_pesquisado ?? r.Nome ?? r.nome ?? '').trim() || 'Importação',
      texto_publicacao: String(r.texto_publicacao ?? r.Texto ?? r.texto ?? '').trim() || undefined,
    }))
    await onImport(parsed)
    setImported(true)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F0F6F6]">
          <h2 className="text-[15px] font-bold text-[#0f1923]">Importar publicações</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#F0F6F6] text-[#9aabb8]"><X size={15} /></button>
        </div>

        {imported ? (
          <div className="px-6 py-8 text-center">
            <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-3" />
            <p className="text-[14px] font-semibold text-[#0f1923]">{rows.length} publicações importadas</p>
            <p className="text-[12px] text-[#9aabb8] mt-1">Processos vinculados automaticamente quando o número foi encontrado</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-[#0F3D3E] text-white text-[13px] font-semibold rounded-xl hover:bg-[#145A5B]">Fechar</button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <p className="text-[13px] text-[#7a8899] leading-relaxed">
              Selecione um arquivo <strong>Excel (.xlsx)</strong> ou <strong>CSV (.csv)</strong>. Processos serão vinculados automaticamente pelo número.
            </p>
            <div className="bg-[#F7F9F9] rounded-xl p-3 text-[11px] font-mono text-[#4a5a6a] leading-relaxed border border-[#E8F0F0]">
              numero_processo · texto_publicacao · data_publicacao · tribunal · nome_pesquisado
            </div>
            <label className="block">
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[#D0DCDC] rounded-2xl cursor-pointer hover:border-[#0F3D3E] hover:bg-[#F7F9F9] transition-colors">
                <Upload size={24} className="text-[#9aabb8] mb-2" />
                <p className="text-[13px] font-medium text-[#4a5a6a]">Clique para selecionar arquivo</p>
                <p className="text-[11px] text-[#9aabb8] mt-0.5">.xlsx, .xls ou .csv</p>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
            </label>
            {rows.length > 0 && (
              <div className="bg-emerald-50 rounded-xl px-4 py-3 text-[13px] text-emerald-700 font-medium border border-emerald-100">
                {rows.length} linhas encontradas — pronto para importar
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#D0DCDC] text-[13px] text-[#7a8899] hover:bg-[#F0F6F6]">Cancelar</button>
              <button onClick={doImport} disabled={!rows.length || loading} className="flex-1 py-2.5 rounded-xl bg-[#0F3D3E] text-white text-[13px] font-semibold hover:bg-[#145A5B] disabled:opacity-40">
                {loading ? 'Importando…' : `Importar ${rows.length} linha(s)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Agenda quick-create modal ────────────────────────────────────────────────

function AgendaQuickModal({
  pub, tipo, processos, onClose, onDone,
}: {
  pub: Publicacao
  tipo: 'tarefa' | 'prazo'
  processos: Processo[]
  onClose: () => void
  onDone: () => void
}) {
  const supabase = createClient()
  const today    = todayISO()
  const [titulo,     setTitulo]     = useState(`${tipo === 'prazo' ? 'PRAZO: ' : ''}${pub.tribunal ?? ''} ${pub.numero_processo ?? ''}`.trim())
  const [data,       setData]       = useState(pub.prazo_data ?? pub.audiencia_data ?? today)
  const [hora,       setHora]       = useState('')
  const [processoId, setProcessoId] = useState(pub.processo_id ?? '')
  const [saving,     setSaving]     = useState(false)

  async function save() {
    if (!titulo.trim()) return
    setSaving(true)
    await supabase.from('agenda_items').insert({
      titulo:      titulo.trim(),
      descricao:   pub.texto_publicacao?.slice(0, 500) ?? null,
      tipo,
      status:      'pendente',
      data_inicio: data,
      hora_inicio: hora || null,
      prazo_final: tipo === 'prazo' ? data : null,
      prioridade:  'alta',
      processo_id: processoId || null,
    })
    setSaving(false)
    onDone()
  }

  const inputCls = 'w-full rounded-xl border border-[#D0DCDC] bg-[#F7F9F9] px-3.5 py-2.5 text-[13px] text-[#0f1923] focus:outline-none focus:border-[#0F3D3E] focus:bg-white transition-colors'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#F0F6F6]">
          <h3 className="text-[14px] font-bold text-[#0f1923]">
            {tipo === 'prazo' ? 'Criar prazo na agenda' : 'Criar tarefa na agenda'}
          </h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-[#F0F6F6] text-[#9aabb8]"><X size={13} /></button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Título *</label>
            <input className={inputCls} value={titulo} onChange={e => setTitulo(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Data *</label>
              <input type="date" className={inputCls} value={data} onChange={e => setData(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Hora</label>
              <input type="time" className={inputCls} value={hora} onChange={e => setHora(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Processo</label>
            <select className={inputCls} value={processoId} onChange={e => setProcessoId(e.target.value)}>
              <option value="">— Nenhum —</option>
              {processos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
            </select>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#D0DCDC] text-[13px] text-[#7a8899] hover:bg-[#F0F6F6]">Cancelar</button>
          <button onClick={save} disabled={!titulo.trim() || !data || saving} className="flex-1 py-2.5 rounded-xl bg-[#0F3D3E] text-white text-[13px] font-semibold hover:bg-[#145A5B] disabled:opacity-40">
            {saving ? 'Criando…' : 'Criar na agenda'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Nova publicação modal ────────────────────────────────────────────────────

function NovaPublicacaoModal({
  processos,
  onClose,
  onDone,
}: {
  processos: Processo[]
  onClose: () => void
  onDone: (pub: Publicacao) => void
}) {
  const supabase = createClient()
  const [texto,      setTexto]      = useState('')
  const [numero,     setNumero]     = useState('')
  const [data,       setData]       = useState(todayISO())
  const [processoId, setProcessoId] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [erro,       setErro]       = useState('')

  async function salvar() {
    if (!texto.trim()) { setErro('O texto da publicação é obrigatório.'); return }
    setSaving(true)
    setErro('')

    const raw  = `manual|${numero}|${data}|${texto.slice(0, 100)}`
    const hash = `manual_${hashStr(raw)}_${Date.now()}`

    // Auto-link processo by number if not manually selected
    let pid = processoId || null
    if (!pid && numero.trim()) {
      const norm = numero.replace(/\D/g, '')
      const found = processos.find(p => (p.numero_processo ?? '').replace(/\D/g, '') === norm)
      if (found) pid = found.id
    }

    const { data: inserted, error } = await supabase
      .from('publicacoes')
      .insert({
        texto_publicacao:    texto.trim(),
        numero_processo:     numero.trim() || null,
        data_publicacao:     data || null,
        processo_id:         pid,
        nome_pesquisado:     'Cadastro manual',
        origem:              'manual',
        status:              'nao_tratada',
        tipo_publicacao:     'publicacao',
        prazo_detectado:     false,
        audiencia_detectada: false,
        hash,
      })
      .select('*, processo:processos(id, titulo, numero_processo)')
      .single()

    setSaving(false)
    if (error) { setErro('Erro ao salvar. Tente novamente.'); return }
    onDone(inserted as Publicacao)
  }

  const inputCls = 'w-full px-3 py-2.5 text-[13px] bg-[#F7F9F9] border border-[#E8F0F0] rounded-xl outline-none focus:bg-white focus:border-[#145A5B] text-[#374151] placeholder:text-[#c5cdd8] transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F0F6F6]">
          <h2 className="text-[15px] font-bold text-[#0f1923]">Nova publicação</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#F0F6F6] text-[#9aabb8]"><X size={15} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Texto da publicação *</label>
            <textarea
              value={texto}
              onChange={e => { setTexto(e.target.value); setErro('') }}
              rows={6}
              placeholder="Cole ou digite o texto da publicação…"
              className={`${inputCls} resize-none font-mono leading-relaxed`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Nº do processo</label>
              <input
                value={numero}
                onChange={e => setNumero(e.target.value)}
                placeholder="0000000-00.0000.0.00.0000"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Data</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Vincular processo</label>
            <select className={inputCls} value={processoId} onChange={e => setProcessoId(e.target.value)}>
              <option value="">— Auto-detectar pelo número —</option>
              {processos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
            </select>
          </div>
          {erro && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#D0DCDC] text-[13px] text-[#7a8899] hover:bg-[#F0F6F6]">Cancelar</button>
            <button onClick={salvar} disabled={!texto.trim() || saving} className="flex-1 py-2.5 rounded-xl bg-[#0F3D3E] text-white text-[13px] font-semibold hover:bg-[#145A5B] disabled:opacity-40">
              {saving ? 'Salvando…' : 'Salvar publicação'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Kanban from publicação modal ────────────────────────────────────────────

function KanbanFromPubModal({
  pub, processos, onClose,
}: {
  pub:       Publicacao
  processos: Processo[]
  onClose:   () => void
}) {
  const [profiles,    setProfiles]    = useState<{ id: string; nome: string }[]>([])
  const [titulo,      setTitulo]      = useState(`Publicação: ${pub.numero_processo ?? pub.texto_publicacao?.slice(0, 50) ?? ''}`.trim())
  const [responsavel, setResponsavel] = useState('')
  const [prioridade,  setPrioridade]  = useState('media')
  const [prazo,       setPrazo]       = useState(pub.prazo_data ?? '')
  const [saving,      setSaving]      = useState(false)
  const [done,        setDone]        = useState(false)
  const [erro,        setErro]        = useState('')

  useEffect(() => {
    fetch('/api/kanban-tasks')
      .then(r => r.json())
      .then(() => {})
      .catch(() => {})
    // Buscar profiles via API de kanban (GET retorna tasks mas não profiles)
    // Usamos createClient no cliente
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient()
        .from('profiles')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome')
        .then(({ data }) => { if (data) setProfiles(data) })
    })
  }, [])

  async function enviar() {
    if (!titulo.trim()) { setErro('Título obrigatório'); return }
    setSaving(true)
    setErro('')
    const res = await fetch('/api/kanban-tasks', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo:           titulo.trim(),
        status:           'a_fazer',
        prioridade,
        responsavel_id:   responsavel || null,
        processo_id:      pub.processo_id ?? null,
        numero_processo:  pub.numero_processo ?? null,
        publicacao_id:    pub.id,
        origem:           'publicacao',
        data:             prazo || null,
      }),
    })
    setSaving(false)
    if (!res.ok) { setErro('Erro ao criar tarefa.'); return }
    setDone(true)
  }

  const inputCls = 'w-full px-3 py-2.5 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-[#145A5B] text-[#374151] placeholder:text-[#c5cdd8] transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#f3f4f6]">
          <h2 className="text-[15px] font-bold text-[#0f1923]">Enviar para Kanban</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#f3f4f6] text-[#9ca3af]"><X size={15} /></button>
        </div>

        {done ? (
          <div className="px-6 py-8 text-center">
            <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-3" />
            <p className="text-[14px] font-semibold text-[#0f1923]">Tarefa criada no Kanban!</p>
            <p className="text-[12px] text-[#9ca3af] mt-1">Acesse o módulo Kanban para acompanhar.</p>
            <button onClick={onClose} className="mt-4 px-5 py-2.5 bg-[#0F3D3E] text-white text-[13px] font-semibold rounded-xl hover:bg-[#145A5B]">Fechar</button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Título da tarefa *</label>
              <input value={titulo} onChange={e => { setTitulo(e.target.value); setErro('') }} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Responsável</label>
                <select value={responsavel} onChange={e => setResponsavel(e.target.value)} className={inputCls}>
                  <option value="">— Sem responsável —</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Prioridade</label>
                <select value={prioridade} onChange={e => setPrioridade(e.target.value)} className={inputCls}>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">Prazo</label>
              <input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} className={inputCls} />
            </div>
            {pub.numero_processo && (
              <p className="text-[11px] text-[#9ca3af]">Processo: <span className="font-mono">{pub.numero_processo}</span></p>
            )}
            {erro && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#D0DCDC] text-[13px] text-[#7a8899] hover:bg-[#f9fafb]">Cancelar</button>
              <button onClick={enviar} disabled={saving || !titulo.trim()} className="flex-1 py-2.5 rounded-xl bg-[#0F3D3E] text-white text-[13px] font-semibold hover:bg-[#145A5B] disabled:opacity-40">
                {saving ? 'Criando…' : 'Enviar para Kanban'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PublicacoesPage({
  initialPublicacoes, processos, advogados,
}: {
  initialPublicacoes: Publicacao[]
  processos: Processo[]
  advogados: Advogado[]
}) {
  const supabase = createClient()
  const [pubs,                  setPubs]                  = useState<Publicacao[]>(initialPublicacoes)
  const [expanded,              setExpanded]              = useState<Publicacao | null>(null)
  const [showNova,              setShowNova]              = useState(false)
  const [showImport,            setShowImport]            = useState(false)
  const [kanbanPub,             setKanbanPub]             = useState<Publicacao | null>(null)
  const [agendaCtx,             setAgendaCtx]             = useState<{ pub: Publicacao; tipo: 'tarefa' | 'prazo' } | null>(null)
  const [sugestaoCtx,           setSugestaoCtx]           = useState<{ pub: Publicacao; targetStatus: string } | null>(null)
  const [modoTrabalho,          setModoTrabalho]          = useState(false)
  const [monitoramentoLoading,  setMonitoramentoLoading]  = useState(false)
  const [monitoramentoFeedback, setMonitoramentoFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const [feriados,              setFeriados]              = useState<string[]>([])

  // Carrega feriados do banco uma vez (usado no cálculo de prazo útil)
  useEffect(() => {
    supabase
      .from('feriados')
      .select('data')
      .gte('data', todayISO())
      .lte('data', `${new Date().getFullYear() + 2}-12-31`)
      .then(({ data }) => {
        if (data) setFeriados(data.map((f: { data: string }) => f.data))
      }, () => {/* tabela pode não existir ainda */})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const executarMonitoramento = useCallback(async () => {
    setMonitoramentoLoading(true)
    setMonitoramentoFeedback(null)
    try {
      // Usuário já está autenticado via sessão — sem CRON_SECRET no client
      const res = await fetch('/api/monitoramento/buscar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMonitoramentoFeedback({ ok: false, msg: json.erro ?? `Erro ${res.status}` })
        return
      }
      // Refresh list
      const { data } = await supabase
        .from('publicacoes')
        .select('*, processo:processos(id, titulo, numero_processo)')
        .order('created_at', { ascending: false })
        .limit(300)
      if (data) setPubs(data as Publicacao[])
      const novas = json.inseridas ?? json.novas ?? 0
      setMonitoramentoFeedback({ ok: true, msg: `Monitoramento concluído — ${novas} nova${novas !== 1 ? 's' : ''} publicação${novas !== 1 ? 'ões' : ''} encontrada${novas !== 1 ? 's' : ''}.` })
    } catch {
      setMonitoramentoFeedback({ ok: false, msg: 'Erro ao executar monitoramento.' })
    } finally {
      setMonitoramentoLoading(false)
    }
  }, [supabase])

  // ── Filters ────────────────────────────────────────────────────────────────
  const today = todayISO()
  const [fBusca,     setFBusca]     = useState('')
  const [fStatus,    setFStatus]    = useState('nao_tratada')
  const [fTribunal,  setFTribunal]  = useState('')
  const [fAdvogado,  setFAdvogado]  = useState('')
  const [fProcesso,  setFProcesso]  = useState('')
  const [fPrazo,     setFPrazo]     = useState(false)
  const [fAudiencia, setFAudiencia] = useState(false)
  const [fDe,        setFDe]        = useState('')
  const [fAte,       setFAte]       = useState('')
  const [page,       setPage]       = useState(1)

  function resetPage() { setPage(1) }

  // ── Filtered + sorted ─────────────────────────────────────────────────────
  const activeStatus = modoTrabalho ? 'nao_tratada' : fStatus

  const filtered = pubs.filter(p => {
    if (activeStatus !== 'todos' && p.status !== activeStatus) return false
    if (fTribunal && p.tribunal !== fTribunal) return false
    if (fAdvogado && !p.nome_pesquisado.toLowerCase().includes(fAdvogado.toLowerCase())) return false
    if (fProcesso && p.processo_id !== fProcesso) return false
    if (fPrazo    && !p.prazo_detectado)  return false
    if (fAudiencia && !p.audiencia_detectada) return false
    if (fDe && (p.data_publicacao ?? '') < fDe) return false
    if (fAte && (p.data_publicacao ?? '') > fAte) return false
    if (fBusca) {
      const q = fBusca.toLowerCase()
      const ok = p.nome_pesquisado.toLowerCase().includes(q)
        || (p.numero_processo ?? '').includes(q)
        || (p.texto_publicacao ?? '').toLowerCase().includes(q)
        || (p.tribunal ?? '').toLowerCase().includes(q)
      if (!ok) return false
    }
    return true
  })

  // Sort by priority (critica → alta → media → baixa), then by data_publicacao desc
  const sorted = [...filtered].sort((a, b) => {
    const pa = PRIORIDADE_CFG[calcPrioridade(a, today)].order
    const pb = PRIORIDADE_CFG[calcPrioridade(b, today)].order
    if (pa !== pb) return pa - pb
    return (b.data_publicacao ?? '').localeCompare(a.data_publicacao ?? '')
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const naoTratadasHoje  = pubs.filter(p => p.status === 'nao_tratada' && p.data_publicacao === today).length
  const tratadasHoje     = pubs.filter(p => p.status === 'tratada'     && p.data_publicacao === today).length
  const descartadasHoje  = pubs.filter(p => p.status === 'descartada'  && p.data_publicacao === today).length
  const totalNaoTratadas = pubs.filter(p => p.status === 'nao_tratada').length
  const criticas         = pubs.filter(p => calcPrioridade(p, today) === 'critica').length

  const tribunais = [...new Set(pubs.map(p => p.tribunal).filter(Boolean))] as string[]

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function commitStatusChange(id: string, status: string) {
    const now = new Date().toISOString()
    setPubs(prev => prev.map(p =>
      p.id === id ? { ...p, status: status as Publicacao['status'], tratado_em: status === 'tratada' ? now : p.tratado_em } : p
    ))
    if (expanded?.id === id) setExpanded(prev => prev ? { ...prev, status: status as Publicacao['status'] } : null)
    await supabase.from('publicacoes').update({
      status,
      ...(status === 'tratada' ? { tratado_em: now } : {}),
    }).eq('id', id)
  }

  function handleStatusChange(id: string, status: string) {
    if (status === 'tratada') {
      const pub = pubs.find(p => p.id === id)
      if (pub?.prazo_detectado) {
        setSugestaoCtx({ pub, targetStatus: status })
        return
      }
    }
    commitStatusChange(id, status)
  }

  async function handleVincular(id: string, processoId: string) {
    const proc = processos.find(p => p.id === processoId)
    setPubs(prev => prev.map(p =>
      p.id === id ? { ...p, processo_id: processoId, processo: proc ? { id: proc.id, titulo: proc.titulo } : null } : p
    ))
    if (expanded?.id === id) setExpanded(prev => prev ? {
      ...prev, processo_id: processoId, processo: proc ? { id: proc.id, titulo: proc.titulo } : null,
    } : null)
    await supabase.from('publicacoes').update({ processo_id: processoId }).eq('id', id)
  }

  async function handleImport(rows: Partial<Publicacao>[]) {
    // Build a lookup map: normalized process number → processo id
    const processMap: Record<string, string> = {}
    processos.forEach(p => {
      if (p.numero_processo) {
        const normalized = p.numero_processo.replace(/\D/g, '')
        processMap[normalized] = p.id
      }
    })

    const toInsert = rows
      .filter(r => r.nome_pesquisado || r.texto_publicacao)
      .map(r => {
        const raw  = `${r.tribunal ?? ''}|${r.numero_processo ?? ''}|${r.data_publicacao ?? ''}|${(r.texto_publicacao ?? '').slice(0, 100)}`
        const hash = `import_${hashStr(raw)}`

        // Auto-link by process number
        const numNorm   = (r.numero_processo ?? '').replace(/\D/g, '')
        const processoId = numNorm ? processMap[numNorm] : undefined

        return {
          numero_processo:  r.numero_processo || null,
          tribunal:         r.tribunal || null,
          data_publicacao:  r.data_publicacao || null,
          nome_pesquisado:  r.nome_pesquisado ?? 'Importação',
          texto_publicacao: r.texto_publicacao || null,
          status:           'nao_tratada' as const,
          origem:           'importacao' as const,
          processo_id:      processoId ?? null,
          hash,
          tipo_publicacao:  'publicacao',
          prazo_detectado:  false,
          audiencia_detectada: false,
        }
      })

    if (!toInsert.length) return

    const { data: inserted } = await supabase
      .from('publicacoes')
      .upsert(toInsert, { onConflict: 'hash', ignoreDuplicates: true })
      .select('*, processo:processos(id, titulo, numero_processo)')

    if (inserted) setPubs(prev => [...(inserted as Publicacao[]), ...prev])
    setShowImport(false)
  }

  function openAgenda(pub: Publicacao, tipo: 'tarefa' | 'prazo') {
    setExpanded(null)
    setSugestaoCtx(null)
    setAgendaCtx({ pub, tipo })
  }

  function handleSugestaoChip(pub: Publicacao, tipo: 'prazo' | 'tarefa' | 'vincular' | 'revisar') {
    if (tipo === 'prazo' || tipo === 'tarefa') {
      openAgenda(pub, tipo)
    }
    // vincular/revisar: expand the modal
    else {
      setExpanded(pub)
    }
  }

  function toggleModoTrabalho() {
    setModoTrabalho(m => !m)
    resetPage()
  }

  return (
    <div className={cn('space-y-5', modoTrabalho ? 'max-w-5xl' : 'max-w-6xl')}>

      {/* ── Modo Trabalho banner ── */}
      {modoTrabalho && (
        <div className="flex items-center gap-4 px-5 py-3.5 bg-[#0F3D3E] rounded-2xl text-white">
          <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Target size={15} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold">Modo Trabalho ativo</p>
            <p className="text-[11px] text-white/60">Exibindo apenas não tratadas · ordenado por prioridade</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-white/70">{sorted.length} publicações</span>
            {criticas > 0 && (
              <span className="text-[11px] font-bold bg-red-500 text-white px-2.5 py-1 rounded-full">
                {criticas} crítica{criticas > 1 ? 's' : ''}
              </span>
            )}
            <button
              onClick={toggleModoTrabalho}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[12px] font-medium transition-colors"
            >
              <Pause size={11} /> Sair
            </button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      {!modoTrabalho && (
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-[24px] font-bold text-[#0f1923] tracking-tight">Publicações</h1>
              <p className="text-[13px] text-[#9aabb8] mt-0.5">Publicações, intimações e prazos do escritório</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={executarMonitoramento}
                disabled={monitoramentoLoading}
                className="flex items-center gap-2 px-4 py-2 border border-[#D0DCDC] text-[#4a5a6a] text-[13px] font-medium rounded-xl hover:bg-[#F7F9F9] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {monitoramentoLoading ? (
                  <>
                    <svg className="animate-spin" width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Executando…
                  </>
                ) : (
                  <><Zap size={13} /> Executar monitoramento</>
                )}
              </button>
              <button
                onClick={toggleModoTrabalho}
                className="flex items-center gap-2 px-4 py-2 bg-[#0F3D3E] hover:bg-[#145A5B] text-white text-[13px] font-semibold rounded-xl transition-colors shadow-sm"
              >
                <Play size={13} /> Trabalhar agora
              </button>
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 px-4 py-2 border border-[#D0DCDC] text-[#4a5a6a] text-[13px] font-medium rounded-xl hover:bg-[#F7F9F9] transition-colors"
              >
                <Upload size={13} /> Importar
              </button>
            </div>
          </div>
          {monitoramentoFeedback && (
            <div className={cn(
              'flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-[13px] border',
              monitoramentoFeedback.ok
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800',
            )}>
              <div className="flex items-center gap-2">
                {monitoramentoFeedback.ok
                  ? <CheckCircle2 size={14} className="flex-shrink-0" />
                  : <XCircle size={14} className="flex-shrink-0" />}
                {monitoramentoFeedback.msg}
              </div>
              <button onClick={() => setMonitoramentoFeedback(null)} className="hover:opacity-60 flex-shrink-0">
                <X size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── KPI counters ── */}
      {!modoTrabalho && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Não tratadas hoje', value: naoTratadasHoje, bg: 'bg-amber-50',   text: 'text-amber-700',   action: () => { setFStatus('nao_tratada'); setFDe(today); setFAte(today); resetPage() } },
            { label: 'Tratadas hoje',     value: tratadasHoje,    bg: 'bg-emerald-50', text: 'text-emerald-700', action: () => { setFStatus('tratada');    setFDe(today); setFAte(today); resetPage() } },
            { label: 'Descartadas hoje',  value: descartadasHoje, bg: 'bg-slate-100',  text: 'text-slate-600',   action: () => { setFStatus('descartada'); setFDe(today); setFAte(today); resetPage() } },
            { label: 'Total não tratadas',value: totalNaoTratadas,bg: 'bg-red-50',     text: 'text-red-700',     action: () => { setFStatus('nao_tratada'); setFDe(''); setFAte(''); resetPage() } },
            { label: 'Críticas',          value: criticas,        bg: criticas > 0 ? 'bg-red-100' : 'bg-slate-50', text: criticas > 0 ? 'text-red-700' : 'text-slate-400',
              action: () => { setFStatus('nao_tratada'); setFPrazo(true); setFDe(''); setFAte(''); resetPage() } },
          ].map(({ label, value, bg, text, action }) => (
            <button key={label} onClick={action}
              className={cn('rounded-2xl border border-[#E8F0F0] shadow-sm p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all duration-150', bg)}>
              <p className={cn('text-[28px] font-black leading-none', text)}>{value}</p>
              <p className="text-[11px] text-[#9aabb8] mt-1.5 font-medium leading-tight">{label}</p>
            </button>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      {!modoTrabalho && (
        <div className="bg-white rounded-2xl border border-[#E8F0F0] shadow-sm px-5 py-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aabb8]" />
              <input
                placeholder="Buscar texto, processo, nome…"
                value={fBusca}
                onChange={e => { setFBusca(e.target.value); resetPage() }}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[#D0DCDC] bg-[#F7F9F9] text-[13px] placeholder:text-[#9aabb8] focus:outline-none focus:border-[#0F3D3E] transition-colors"
              />
            </div>
            <select value={fTribunal} onChange={e => { setFTribunal(e.target.value); resetPage() }}
              className="rounded-xl border border-[#D0DCDC] bg-white px-3 py-2 text-[13px] text-[#4a5a6a] focus:outline-none focus:border-[#0F3D3E]">
              <option value="">Todos os tribunais</option>
              {tribunais.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="Nome pesquisado…" value={fAdvogado}
              onChange={e => { setFAdvogado(e.target.value); resetPage() }}
              className="rounded-xl border border-[#D0DCDC] bg-[#F7F9F9] px-3.5 py-2 text-[13px] placeholder:text-[#9aabb8] focus:outline-none focus:border-[#0F3D3E] transition-colors w-44" />
            <select value={fProcesso} onChange={e => { setFProcesso(e.target.value); resetPage() }}
              className="rounded-xl border border-[#D0DCDC] bg-white px-3 py-2 text-[13px] text-[#4a5a6a] focus:outline-none focus:border-[#0F3D3E] max-w-[200px]">
              <option value="">Todos os processos</option>
              {processos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-[#F0F6F6]">
            <div className="flex bg-[#F0F6F6] rounded-xl p-1 gap-0.5">
              {[
                { v: 'nao_tratada', l: 'Não tratadas' },
                { v: 'tratada',     l: 'Tratadas'     },
                { v: 'descartada',  l: 'Descartadas'  },
                { v: 'todos',       l: 'Todas'        },
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
                fPrazo ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-[#D0DCDC] text-[#7a8899] hover:border-[#c8d8d8]')}>
              <AlertTriangle size={11} /> Com prazo
            </button>
            <button onClick={() => { setFAudiencia(f => !f); resetPage() }}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-medium transition-colors',
                fAudiencia ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-[#D0DCDC] text-[#7a8899] hover:border-[#c8d8d8]')}>
              <Gavel size={11} /> Com audiência
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <input type="date" value={fDe}  onChange={e => { setFDe(e.target.value);  resetPage() }}
                className="rounded-xl border border-[#D0DCDC] bg-white px-3 py-1.5 text-[12px] text-[#4a5a6a] focus:outline-none focus:border-[#0F3D3E]" />
              <span className="text-[11px] text-[#9aabb8]">até</span>
              <input type="date" value={fAte} onChange={e => { setFAte(e.target.value); resetPage() }}
                className="rounded-xl border border-[#D0DCDC] bg-white px-3 py-1.5 text-[12px] text-[#4a5a6a] focus:outline-none focus:border-[#0F3D3E]" />
            </div>
          </div>
        </div>
      )}

      {/* ── Work mode search ── */}
      {modoTrabalho && (
        <div className="relative">
          <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9aabb8]" />
          <input
            placeholder="Buscar publicação…"
            value={fBusca}
            onChange={e => { setFBusca(e.target.value); resetPage() }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#D0DCDC] bg-white text-[13px] placeholder:text-[#9aabb8] focus:outline-none focus:border-[#0F3D3E] shadow-sm transition-colors"
          />
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-[#E8F0F0] shadow-sm overflow-hidden">
        {/* Header row */}
        <div className={cn(
          'grid gap-3 px-5 py-3 border-b border-[#F0F6F6] bg-[#FAFCFC]',
          modoTrabalho
            ? 'grid-cols-[4px_1fr_200px_140px]'
            : 'grid-cols-[4px_1fr_130px_120px_110px_100px]'
        )}>
          <div />
          {(modoTrabalho
            ? ['Publicação', 'Ações rápidas', 'Status']
            : ['Publicação', 'Tribunal', 'Processo', 'Data', 'Status']
          ).map(h => (
            <p key={h} className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-wide">{h}</p>
          ))}
        </div>

        {paginated.length === 0 ? (
          <div className="py-16 text-center">
            <FileText size={28} className="text-[#c8d8d8] mx-auto mb-3" />
            <p className="text-[14px] font-medium text-[#7a8899]">
              {pubs.length === 0 ? 'Nenhuma publicação cadastrada' : 'Nenhum resultado com esses filtros'}
            </p>
            <p className="text-[12px] text-[#9aabb8] mt-1">
              {pubs.length === 0 ? 'Importe um arquivo ou aguarde a execução do monitoramento' : 'Tente ajustar os filtros'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#f5f7fa]">
            {paginated.map(pub => {
              const prio    = calcPrioridade(pub, today)
              const prioCfg = PRIORIDADE_CFG[prio]
              const tipoCfg = TIPO_CFG[pub.tipo_publicacao] ?? TIPO_CFG.outro
              const isNao   = pub.status === 'nao_tratada'

              return (
                <div
                  key={pub.id}
                  className={cn(
                    'grid gap-3 px-5 py-3 hover:bg-[#f9fafb] cursor-pointer transition-colors items-start',
                    modoTrabalho
                      ? 'grid-cols-[4px_1fr_200px_140px]'
                      : 'grid-cols-[4px_1fr_130px_120px_110px_100px]',
                    pub.status === 'descartada' && 'opacity-50',
                  )}
                  onClick={() => setExpanded(pub)}
                >
                  {/* Priority bar */}
                  <div className={cn('w-1 self-stretch rounded-full my-0.5', isNao ? prioCfg.bar : 'bg-slate-200')} />

                  {/* Main content */}
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', tipoCfg.bg, tipoCfg.text)}>
                        {tipoCfg.label}
                      </span>
                      {isNao && <PrioridadeBadge prioridade={prio} />}
                      {pub.prazo_detectado && <AlertTriangle size={11} className="text-orange-500 flex-shrink-0" />}
                      {pub.audiencia_detectada && <Gavel size={11} className="text-rose-500 flex-shrink-0" />}
                      {!pub.prazo_detectado && !pub.audiencia_detectada && pub.texto_publicacao &&
                        /\b(intime-se|intimar|manifestar-se|contestação|contrarrazões|impugnação|defesa)\b/i.test(pub.texto_publicacao) &&
                        <Scale size={11} className="text-violet-500 flex-shrink-0" />
                      }
                      {isNao && <SugestaoChip pub={pub} onClick={tipo => handleSugestaoChip(pub, tipo)} />}
                    </div>
                    <p className="text-[13px] font-medium text-[#0f1923] truncate leading-tight">
                      {pub.texto_publicacao?.slice(0, modoTrabalho ? 120 : 80) ?? '(sem texto)'}
                    </p>
                    {!modoTrabalho && (
                      <p className="text-[11px] text-[#9aabb8] truncate">{pub.nome_pesquisado}</p>
                    )}
                    {modoTrabalho && pub.processo && (
                      <p className="text-[11px] text-[#145A5B] font-medium truncate">{pub.processo.titulo}</p>
                    )}
                  </div>

                  {modoTrabalho ? (
                    // Work mode: quick actions column
                    <div className="pt-0.5">
                      <QuickActions
                        pub={pub}
                        processos={processos}
                        onStatusChange={handleStatusChange}
                        onVincular={handleVincular}
                        onCreateAgenda={openAgenda}
                        onExpand={() => setExpanded(pub)}
                      />
                    </div>
                  ) : (
                    // Normal mode: tribunal + processo + data columns
                    <>
                      <p className="text-[12px] text-[#4a5a6a] truncate pt-0.5">{pub.tribunal ?? '—'}</p>
                      <div className="min-w-0 pt-0.5">
                        {pub.processo
                          ? <p className="text-[11px] text-[#145A5B] font-medium truncate">{pub.processo.titulo}</p>
                          : pub.numero_processo
                            ? <p className="text-[11px] text-[#9aabb8] font-mono truncate">{pub.numero_processo}</p>
                            : <p className="text-[11px] text-[#c8d8d8]">—</p>}
                      </div>
                      <p className="text-[12px] text-[#7a8899] pt-0.5">{fmt(pub.data_publicacao)}</p>
                    </>
                  )}

                  {/* Status column */}
                  <div onClick={e => e.stopPropagation()} className="pt-0.5">
                    <StatusPill status={pub.status} onChange={s => handleStatusChange(pub.id, s)} />
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
              {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} de {sorted.length}
            </p>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#D0DCDC] disabled:opacity-30 hover:bg-[#F0F6F6] transition-colors">
                <ChevronLeft size={13} />
              </button>
              <span className="text-[12px] text-[#4a5a6a] px-2">{page} / {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#D0DCDC] disabled:opacity-30 hover:bg-[#F0F6F6] transition-colors">
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {expanded && (
        <PublicacaoModal
          pub={expanded}
          processos={processos}
          feriados={feriados}
          onClose={() => setExpanded(null)}
          onStatusChange={handleStatusChange}
          onVincular={handleVincular}
          onCreateAgenda={openAgenda}
          onKanban={pub => { setExpanded(null); setKanbanPub(pub) }}
        />
      )}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onImport={handleImport} />
      )}
      {agendaCtx && (
        <AgendaQuickModal
          pub={agendaCtx.pub}
          tipo={agendaCtx.tipo}
          processos={processos}
          onClose={() => setAgendaCtx(null)}
          onDone={() => {
            setAgendaCtx(null)
            if (sugestaoCtx) {
              commitStatusChange(sugestaoCtx.pub.id, sugestaoCtx.targetStatus)
              setSugestaoCtx(null)
            }
          }}
        />
      )}
      {sugestaoCtx && (
        <SugestaoPrazoModal
          pub={sugestaoCtx.pub}
          processos={processos}
          onCriarPrazo={() => openAgenda(sugestaoCtx.pub, 'prazo')}
          onCriarTarefa={() => openAgenda(sugestaoCtx.pub, 'tarefa')}
          onPular={() => {
            commitStatusChange(sugestaoCtx.pub.id, sugestaoCtx.targetStatus)
            setSugestaoCtx(null)
          }}
          onCancelar={() => setSugestaoCtx(null)}
        />
      )}
      {kanbanPub && (
        <ProvidenciaModal
          publicacaoId={kanbanPub.id}
          publicacaoTexto={kanbanPub.texto_publicacao ?? undefined}
          processoId={kanbanPub.processo_id ?? null}
          processoNumero={kanbanPub.numero_processo ?? null}
          processoTitulo={kanbanPub.processo?.titulo ?? null}
          prazoData={kanbanPub.prazo_data ?? null}
          prazoDetectado={kanbanPub.prazo_detectado}
          onClose={() => setKanbanPub(null)}
        />
      )}
    </div>
  )
}
