'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  ArrowLeft, Newspaper, Loader2, Sparkles,
  AlertTriangle, CalendarDays, CheckCircle2, ListTodo,
  Scale, Info, BookOpen, PenLine, History, Search,
  Link2, Copy, Check, ChevronRight, Building2, Hash,
  ClipboardCheck, X, Zap, User, ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { AnalisePublicacao } from '@/lib/ai/prompts'
import type { KanbanPrioridade } from '@/types/kanban'
import ProvidenciaModal from '@/components/kanban/ProvidenciaModal'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface PubItem {
  id:               string
  resumo:           string 
  numero_processo:  string | null
  data_publicacao:  string | null
  tribunal:         string | null
  processo:         { id: string; titulo: string } | null
}

interface ProcessoSimples {
  id:              string
  numero_processo: string | null
  titulo:          string
}

// ─── Urgência ─────────────────────────────────────────────────────────────────

const U = {
  critica: {
    label:   'Crítica',
    badge:   'bg-red-100 text-red-700 ring-1 ring-red-200',
    strip:   'bg-red-500',
    border:  'border-red-400',
    icon:    <AlertTriangle size={13} className="text-red-600" />,
    iconLg:  <AlertTriangle size={20} className="text-red-500" />,
    dot:     'bg-red-500',
  },
  alta: {
    label:   'Alta',
    badge:   'bg-orange-100 text-orange-700 ring-1 ring-orange-200',
    strip:   'bg-orange-500',
    border:  'border-orange-400',
    icon:    <AlertTriangle size={13} className="text-orange-500" />,
    iconLg:  <AlertTriangle size={20} className="text-orange-500" />,
    dot:     'bg-orange-500',
  },
  media: {
    label:   'Média',
    badge:   'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
    strip:   'bg-amber-400',
    border:  'border-amber-300',
    icon:    <AlertTriangle size={13} className="text-amber-500" />,
    iconLg:  <AlertTriangle size={20} className="text-amber-400" />,
    dot:     'bg-amber-400',
  },
  baixa: {
    label:   'Baixa',
    badge:   'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
    strip:   'bg-[#145A5B]',
    border:  'border-[#145A5B]',
    icon:    <CheckCircle2 size={13} className="text-emerald-600" />,
    iconLg:  <CheckCircle2 size={20} className="text-emerald-600" />,
    dot:     'bg-emerald-500',
  },
} as const

// ─── Regex CNJ ────────────────────────────────────────────────────────────────

const RE_CNJ = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g

function normalizarNumero(n: string | null | undefined) {
  return (n ?? '').replace(/\D/g, '')
}

function extrairNumeroCNJ(texto: string): string | null {
  const m = texto.match(RE_CNJ)
  return m?.[0] ?? null
}

function formatarData(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
}

function formatarAnaliseParaCopia(analise: AnalisePublicacao, processo: ProcessoSimples | null): string {
  const linhas: string[] = [
    `ANÁLISE DE PUBLICAÇÃO — ${new Date().toLocaleDateString('pt-BR')}`,
    processo ? `Processo: ${processo.numero_processo ?? processo.titulo}` : '',
    '',
    'RESUMO',
    analise.resumo,
    '',
  ]
  if (analise.prazo_detectado) {
    linhas.push('PRAZO IDENTIFICADO')
    if (analise.tipo_prazo)    linhas.push(analise.tipo_prazo)
    if (analise.prazo_data)    linhas.push(new Date(analise.prazo_data + 'T12:00:00').toLocaleDateString('pt-BR'))
    if (analise.prazo_descricao) linhas.push(analise.prazo_descricao)
    if (analise.fundamentacao) linhas.push(analise.fundamentacao)
    linhas.push('')
  }
  linhas.push('PROVIDÊNCIA SUGERIDA', analise.sugestao_acao, '')
  linhas.push(`URGÊNCIA: ${U[analise.urgencia]?.label ?? analise.urgencia}`)
  if (analise.observacoes) linhas.push('', 'OBSERVAÇÕES', analise.observacoes)
  return linhas.filter(l => l !== null).join('\n')
}

// ─── Helpers de delegação ──────────────────────────────────────────────────────

function urgToPrioridade(urg?: string): KanbanPrioridade {
  if (urg === 'critica') return 'urgente'
  if (urg === 'alta')    return 'alta'
  if (urg === 'media')   return 'media'
  return 'baixa'
}

function buildDescricao(a: AnalisePublicacao): string {
  return [
    a.resumo,
    a.prazo_descricao ? `Prazo: ${a.prazo_descricao}` : null,
    a.fundamentacao   ? `Fundamento: ${a.fundamentacao}` : null,
    a.observacoes     ? `⚠ ${a.observacoes}` : null,
  ].filter(Boolean).join('\n\n')
}

function fmtDateShort(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PublicacaoIA({
  publicacoes,
  processos,
  userId,
}: {
  publicacoes: PubItem[]
  processos:   ProcessoSimples[]
  userId:      string
}) {
  // Modo de entrada
  const [modo,           setModo]           = useState<'sistema' | 'manual'>('sistema')
  const [busca,          setBusca]          = useState('')
  const [buscaAberta,    setBuscaAberta]    = useState(false)
  const [pubId,          setPubId]          = useState('')
  const [textoManual,    setTextoManual]    = useState('')

  // Processo vinculado
  const [processoVinculadoId, setProcessoVinculadoId] = useState('')
  const [autoVinculado,       setAutoVinculado]       = useState(false)
  const [mostrarVincular,     setMostrarVincular]     = useState(false)

  // Análise
  const [analise,  setAnalise]  = useState<AnalisePublicacao | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [erro,     setErro]     = useState('')

  // Ações
  const [criando,       setCriando]       = useState<'prazo' | 'tarefa' | null>(null)
  const [criado,        setCriado]        = useState<'prazo' | 'tarefa' | null>(null)
  const [salvando,      setSalvando]      = useState(false)
  const [salvo,         setSalvo]         = useState(false)
  const [copiado,       setCopiado]       = useState(false)
  const [showProvidencia, setShowProvidencia] = useState(false)

  // Delegação rápida
  const [profiles,             setProfiles]             = useState<{ id: string; nome: string }[]>([])
  const [responsavelDelegacao, setResponsavelDelegacao] = useState(userId)
  const [delegando,            setDelegando]            = useState(false)
  const [delegado,             setDelegado]             = useState<{
    kanban: boolean; prazo: boolean; responsavelNome: string | null
  } | null>(null)

  const buscaRef = useRef<HTMLDivElement>(null)

  // ── Carregar perfis para delegação ────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    supabase.from('profiles').select('id, nome').eq('ativo', true).order('nome')
      .then(({ data }) => { if (data) setProfiles(data) })
  }, [])

  // ── Publicação e processo selecionados ────────────────────────────────────

  const pub = publicacoes.find(p => p.id === pubId) ?? null
  const processoVinculado = processos.find(p => p.id === processoVinculadoId) ?? null

  // ── Filtro de publicações ─────────────────────────────────────────────────

  const publicacoesFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const lista = q
      ? publicacoes.filter(p =>
          p.numero_processo?.toLowerCase().includes(q) ||
          p.tribunal?.toLowerCase().includes(q) ||
          p.processo?.titulo?.toLowerCase().includes(q),
        )
      : publicacoes
    return lista.slice(0, 30)
  }, [busca, publicacoes])

  // ── Auto-vincular processo ────────────────────────────────────────────────

  useEffect(() => {
    const numRef = modo === 'sistema' ? pub?.numero_processo : extrairNumeroCNJ(textoManual)

    if (pub?.processo?.id) {
      setProcessoVinculadoId(pub.processo.id)
      setAutoVinculado(false)
      return
    }
    if (numRef) {
      const norm  = normalizarNumero(numRef)
      const match = processos.find(p => normalizarNumero(p.numero_processo) === norm)
      if (match) { setProcessoVinculadoId(match.id); setAutoVinculado(true); return }
    }
    setProcessoVinculadoId('')
    setAutoVinculado(false)
  }, [pub, textoManual, processos, modo])

  // ── Resetar ao trocar modo ────────────────────────────────────────────────

  function trocarModo(m: 'sistema' | 'manual') {
    setModo(m)
    setErro('')
    setAnalise(null)
    setCriado(null)
    setSalvo(false)
    setPubId('')
    setBusca('')
    setTextoManual('')
  }

  // ── Analisar ──────────────────────────────────────────────────────────────

  async function analisar() {
    const texto = modo === 'sistema' ? pub?.resumo?.trim() : textoManual.trim()
    if (!texto) {
      setErro(modo === 'sistema'
        ? 'Selecione uma publicação para analisar.'
        : 'Cole o texto da publicação antes de analisar.')
      return
    }
    setErro(''); setAnalise(null); setLoading(true); setCriado(null); setSalvo(false); setDelegado(null)

    try {
      const res = await fetch('/api/ia/publicacao', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          textoPublicacao: texto,
          numeroProcesso:  modo === 'sistema' ? pub?.numero_processo ?? undefined : undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        setErro(err.error ?? 'Erro na análise')
        return
      }
      const data: AnalisePublicacao = await res.json()
      setAnalise(data)
      if (modo === 'sistema') salvarHistorico(data)  // auto-salva só no modo sistema
    } catch {
      setErro('Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // ── Salvar no histórico ───────────────────────────────────────────────────

  async function salvarHistorico(data: AnalisePublicacao) {
    setSalvando(true)
    const supabase = createClient()
    await supabase.from('ia_analises_publicacoes').insert({
      publicacao_id:   pub?.id ?? null,
      processo_id:     processoVinculadoId || null,
      criado_por:      userId,
      resumo:          data.resumo,
      tipo_prazo:      data.tipo_prazo,
      prazo_detectado: data.prazo_detectado,
      prazo_data:      data.prazo_data,
      prazo_descricao: data.prazo_descricao,
      fundamentacao:   data.fundamentacao,
      sugestao_acao:   data.sugestao_acao,
      urgencia:        data.urgencia,
      observacoes:     data.observacoes,
    })
    setSalvando(false); setSalvo(true)
  }

  // ── Gerar prazo ───────────────────────────────────────────────────────────

  async function criarPrazo() {
    if (!analise) return
    setCriando('prazo')
    const supabase   = createClient()
    const numProc    = pub?.numero_processo ?? processoVinculado?.numero_processo
    const { error }  = await supabase.from('agenda_items').insert({
      titulo:      `${analise.tipo_prazo ?? 'Prazo'} — ${numProc ?? processoVinculado?.titulo ?? 'Publicação'}`,
      descricao:   [analise.prazo_descricao, analise.fundamentacao].filter(Boolean).join('\n') || analise.resumo,
      tipo:        'prazo',
      status:      'pendente',
      prioridade:  analise.urgencia === 'critica' || analise.urgencia === 'alta' ? 'alta' : 'media',
      data_inicio: analise.prazo_data ?? new Date().toISOString().slice(0, 10),
      prazo_final: analise.prazo_data ?? undefined,
      processo_id: processoVinculadoId || undefined,
    })
    setCriando(null)
    if (!error) setCriado('prazo')
  }

  // ── Criar tarefa ──────────────────────────────────────────────────────────

  async function criarTarefa() {
    if (!analise) return
    setCriando('tarefa')
    const supabase  = createClient()
    const { error } = await supabase.from('kanban_tasks').insert({
      titulo:      analise.sugestao_acao.slice(0, 100),
      descricao:   [analise.resumo, analise.observacoes].filter(Boolean).join('\n\n'),
      status:      'a_fazer',
      tipo:        'prazo',
      processo_id: processoVinculadoId || undefined,
      data:        analise.prazo_data ?? undefined,
    })
    setCriando(null)
    if (!error) setCriado('tarefa')
  }

  // ── Delegar diretamente (sem modal) ──────────────────────────────────────

  async function delegarDireto() {
    if (!analise) return
    setDelegando(true)
    try {
      const res = await fetch('/api/providencia', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicacao_id:   pub?.id ?? null,
          titulo:          analise.sugestao_acao.slice(0, 150),
          descricao:       buildDescricao(analise),
          responsavel_id:  responsavelDelegacao || null,
          processo_id:     processoVinculadoId  || null,
          numero_processo: pub?.numero_processo  || null,
          prioridade:      urgToPrioridade(analise.urgencia),
          status_kanban:   'a_fazer',
          criar_prazo:     analise.prazo_detectado && !!analise.prazo_data,
          prazo_data:      analise.prazo_data    || null,
          urgencia:        analise.urgencia,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const responsavelNome = profiles.find(p => p.id === responsavelDelegacao)?.nome ?? null
      setDelegado({ kanban: !!data.kanban_task, prazo: !!data.agenda_item, responsavelNome })
      setCriado('tarefa')
    } catch {
      setErro('Erro ao criar providência. Tente novamente.')
    } finally {
      setDelegando(false)
    }
  }

  // ── Copiar análise ────────────────────────────────────────────────────────

  async function copiarAnalise() {
    if (!analise) return
    await navigator.clipboard.writeText(formatarAnaliseParaCopia(analise, processoVinculado))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  // ── Urgência da análise ───────────────────────────────────────────────────

  const urgCfg = analise ? (U[analise.urgencia] ?? U.media) : null

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="flex flex-col gap-5 max-w-[1200px]">

      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link
          href="/ia-juridica"
          className="p-2 rounded-xl text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-[20px] font-semibold text-[#0f1923] tracking-tight flex items-center gap-2">
            <Newspaper size={17} className="text-violet-600" />
            Análise de Publicação
          </h1>
          <p className="text-[12px] text-[#7a8899] mt-0.5">
            Identifique prazos, providências e urgência processual com IA
          </p>
        </div>
      </div>

      {/* ── Dois painéis ──────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">

        {/* ════════════════════════════════════════════════════════════
            PAINEL ESQUERDO — ENTRADA
        ════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-[0_1px_6px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden">

          {/* Cabeçalho do painel */}
          <div className="px-5 py-4 border-b border-[#f3f4f6]">
            <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">
              Origem da publicação
            </p>
            <div className="flex gap-1 bg-[#f9fafb] p-1 rounded-xl">
              {(['sistema', 'manual'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => trocarModo(m)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-[12px] font-semibold rounded-lg transition-all',
                    modo === m
                      ? 'bg-white text-[#0f1923] shadow-sm'
                      : 'text-[#9ca3af] hover:text-[#374151]',
                  )}
                >
                  {m === 'sistema' ? <><Search size={11} /> Do sistema</> : <><PenLine size={11} /> Texto livre</>}
                </button>
              ))}
            </div>
          </div>

          {/* Corpo do painel */}
          <div className="flex-1 flex flex-col px-5 py-4 gap-4 overflow-y-auto">

            {/* ── Modo sistema ── */}
            {modo === 'sistema' && (
              <div className="flex flex-col gap-3">
                <p className="text-[11px] font-semibold text-[#374151]">Buscar publicação</p>

                {/* Campo de busca */}
                <div className="relative" ref={buscaRef}>
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" />
                  <input
                    type="text"
                    value={busca}
                    onChange={e => { setBusca(e.target.value); setBuscaAberta(true) }}
                    onFocus={() => setBuscaAberta(true)}
                    placeholder="Buscar por nº processo ou tribunal…"
                    className="w-full pl-9 pr-3 py-2.5 text-[12px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-violet-400 text-[#1a1d23] placeholder:text-[#c5cdd8] transition-all"
                  />
                  {busca && (
                    <button onClick={() => { setBusca(''); setBuscaAberta(false); setPubId('') }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#374151]">
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Publicação selecionada */}
                {pub && (
                  <div className="bg-violet-50 border border-violet-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
                    <Newspaper size={13} className="text-violet-600 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      {pub.data_publicacao && (
                        <p className="text-[10px] text-violet-500 font-medium mb-0.5">
                          {pub.data_publicacao.slice(0, 10)}
                          {pub.tribunal && ` · ${pub.tribunal}`}
                        </p>
                      )}
                      <p className="text-[12px] font-semibold text-violet-900 truncate">
                        {pub.numero_processo ?? pub.processo?.titulo ?? pub.id.slice(0, 12)}
                      </p>
                    </div>
                    <button onClick={() => { setPubId(''); setBusca('') }}
                      className="ml-auto text-violet-400 hover:text-violet-700 shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* Lista filtrada */}
                {!pub && buscaAberta && publicacoesFiltradas.length > 0 && (
                  <div className="border border-[#e5e7eb] rounded-xl overflow-hidden max-h-56 overflow-y-auto shadow-sm">
                    {publicacoesFiltradas.map((p, i) => (
                      <button
                        key={p.id}
                        onClick={() => { setPubId(p.id); setBuscaAberta(false) }}
                        className={cn(
                          'w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-violet-50 transition-colors',
                          i > 0 && 'border-t border-[#f9fafb]',
                        )}
                      >
                        <Newspaper size={12} className="text-[#9ca3af] mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-[#374151] truncate">
                            {p.numero_processo ?? p.processo?.titulo ?? p.id.slice(0, 12)}
                          </p>
                          {(p.data_publicacao || p.tribunal) && (
                            <p className="text-[10px] text-[#9ca3af]">
                              {[p.data_publicacao?.slice(0, 10), p.tribunal].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                        <ChevronRight size={12} className="text-[#d1d5db] ml-auto mt-0.5 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}

                {!pub && publicacoes.length === 0 && (
                  <p className="text-[12px] text-[#9ca3af] italic text-center py-4">
                    Nenhuma publicação cadastrada no sistema
                  </p>
                )}

                {/* Preview do texto quando selecionado */}
                {pub?.resumo && (
                  <div className="bg-[#f9fafb] rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1.5">
                      Texto
                    </p>
                    <p className="text-[11px] text-[#6b7280] leading-relaxed line-clamp-5 font-mono">
                      {pub.resumo}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Modo manual ── */}
            {modo === 'manual' && (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-semibold text-[#374151]">
                  Texto da publicação
                </p>
                <textarea
                  value={textoManual}
                  onChange={e => { setTextoManual(e.target.value); setErro('') }}
                  rows={12}
                  placeholder={'Cole aqui o texto completo da publicação…\n\nEx:\nIntimação — Processo nº 1234567-89.2024.8.26.0100\nIntime-se o advogado da parte autora para, no prazo de 15 dias úteis, manifestar-se sobre a contestação apresentada.'}
                  className="w-full px-3 py-3 text-[11.5px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-violet-400 text-[#374151] placeholder:text-[#c5cdd8] resize-none leading-relaxed transition-all font-mono"
                />
                {textoManual.trim().length > 0 && (
                  <p className="text-[10px] text-[#9ca3af]">{textoManual.trim().length} caracteres</p>
                )}
              </div>
            )}

            {/* ── Vínculo com processo ── */}
            <div className="border-t border-[#f9fafb] pt-3">
              <button
                onClick={() => setMostrarVincular(v => !v)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-[#9ca3af] hover:text-[#374151] transition-colors w-full"
              >
                <Link2 size={11} />
                {processoVinculado
                  ? `Vinculado: ${processoVinculado.numero_processo ?? processoVinculado.titulo}`
                  : 'Vincular ao processo'}
                {autoVinculado && processoVinculado && (
                  <span className="ml-1 text-[9px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">
                    Auto
                  </span>
                )}
                <ChevronRight size={11} className={cn('ml-auto transition-transform', mostrarVincular && 'rotate-90')} />
              </button>
              {mostrarVincular && (
                <div className="mt-2 relative">
                  <select
                    value={processoVinculadoId}
                    onChange={e => { setProcessoVinculadoId(e.target.value); setAutoVinculado(false) }}
                    className="w-full px-3 py-2 text-[12px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-violet-400 text-[#374151] transition-all appearance-none"
                  >
                    <option value="">— Sem vínculo —</option>
                    {processos.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.numero_processo ? `${p.numero_processo} — ` : ''}{p.titulo}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Erro */}
            {erro && (
              <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                {erro}
              </p>
            )}
          </div>

          {/* Botão principal — fixo na base do painel */}
          <div className="px-5 py-4 border-t border-[#f3f4f6] bg-[#fafbfc]">
            <button
              onClick={analisar}
              disabled={loading || (modo === 'sistema' && !pubId) || (modo === 'manual' && !textoManual.trim())}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#1D5F60] hover:bg-[#27777A] text-white text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {loading ? 'Analisando…' : 'Analisar publicação'}
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
            PAINEL DIREITO — RESULTADO
        ════════════════════════════════════════════════════════════ */}
        <div className={cn(
          'rounded-lg border overflow-hidden shadow-[0_1px_6px_rgba(0,0,0,0.04)] flex flex-col transition-all',
          urgCfg ? `border-l-4 ${urgCfg.border} border-t border-r border-b border-[#E2DDD8] bg-white` : 'border-[#E2DDD8] bg-white',
        )}>

          {/* Estado vazio */}
          {!loading && !analise && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20 px-8 text-center">
              <div className="w-16 h-16 rounded-lg bg-[#f3f4f6] flex items-center justify-center">
                <Newspaper size={26} className="text-[#d1d5db]" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#374151] mb-1">
                  Nenhuma análise realizada
                </p>
                <p className="text-[12px] text-[#9ca3af] leading-relaxed max-w-xs">
                  Selecione uma publicação ou cole um texto para identificar prazos, urgência e providências.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-1">
                {['Prazo', 'Urgência', 'Providência', 'Fundamento legal'].map(tag => (
                  <span key={tag} className="text-[10px] text-[#9ca3af] bg-[#f9fafb] border border-[#f3f4f6] px-3 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
              <div className="w-12 h-12 rounded-lg bg-violet-50 flex items-center justify-center">
                <Loader2 size={22} className="text-violet-500 animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-[13px] font-semibold text-[#374151]">Analisando publicação…</p>
                <p className="text-[12px] text-[#9ca3af] mt-0.5">Identificando prazos e providências</p>
              </div>
            </div>
          )}

          {/* Resultado */}
          {!loading && analise && urgCfg && (
            <div className="flex flex-col flex-1 overflow-y-auto">

              {/* ── Cabeçalho com urgência ── */}
              <div className="px-6 py-4 border-b border-[#f3f4f6] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {urgCfg.iconLg}
                  <div>
                    <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">Urgência</p>
                    <p className="text-[16px] font-bold text-[#0f1923] leading-tight">{urgCfg.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  {modo === 'manual' && (
                    <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      Teste — não salvo
                    </span>
                  )}
                  {modo === 'sistema' && salvo && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <History size={9} /> Salvo
                    </span>
                  )}
                  {modo === 'sistema' && salvando && (
                    <span className="text-[10px] text-[#9ca3af] flex items-center gap-1">
                      <Loader2 size={9} className="animate-spin" /> Salvando…
                    </span>
                  )}
                  <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold', urgCfg.badge)}>
                    {urgCfg.icon} {urgCfg.label}
                  </span>
                </div>
              </div>

              {/* ── Dados detectados (processo, tribunal) ── */}
              {(pub?.numero_processo || pub?.tribunal || processoVinculado || analise.tipo_prazo) && (
                <div className="px-6 py-3 border-b border-[#f9fafb] flex flex-wrap gap-3">
                  {(pub?.numero_processo || processoVinculado?.numero_processo) && (
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#374151] bg-[#f9fafb] border border-[#e5e7eb] px-2.5 py-1 rounded-lg">
                      <Hash size={11} className="text-[#9ca3af]" />
                      {pub?.numero_processo ?? processoVinculado?.numero_processo}
                    </span>
                  )}
                  {pub?.tribunal && (
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#374151] bg-[#f9fafb] border border-[#e5e7eb] px-2.5 py-1 rounded-lg">
                      <Building2 size={11} className="text-[#9ca3af]" />
                      {pub.tribunal}
                    </span>
                  )}
                  {processoVinculado && (
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-violet-700 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-lg">
                      <Link2 size={11} />
                      {processoVinculado.titulo}
                    </span>
                  )}
                  {analise.tipo_prazo && (
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#1D5F60] bg-[#E8F2F2] border border-[#E2DDD8] px-2.5 py-1 rounded-lg">
                      <CalendarDays size={11} />
                      {analise.tipo_prazo}
                    </span>
                  )}
                </div>
              )}

              <div className="divide-y divide-[#f9fafb] flex-1">

                {/* ── Bloco 1: Resumo ── */}
                <div className="px-6 py-4">
                  <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <BookOpen size={10} /> O que aconteceu
                  </p>
                  <p className="text-[13px] text-[#374151] leading-relaxed">{analise.resumo}</p>
                </div>

                {/* ── Bloco 2: Prazo ── */}
                <div className={cn('px-6 py-4', analise.prazo_detectado && 'bg-amber-50/30')}>
                  <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <CalendarDays size={10} /> Prazo
                  </p>
                  {analise.prazo_detectado ? (
                    <div className="space-y-2.5">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                          <CalendarDays size={17} className="text-amber-600" />
                        </div>
                        <div>
                          {analise.tipo_prazo && (
                            <p className="text-[11px] font-bold text-[#1D5F60] uppercase tracking-wide mb-0.5">
                              {analise.tipo_prazo}
                            </p>
                          )}
                          {analise.prazo_data && (
                            <p className="text-[15px] font-bold text-[#0f1923] leading-snug">
                              {formatarData(analise.prazo_data)}
                            </p>
                          )}
                          {analise.prazo_descricao && (
                            <p className="text-[12px] text-[#6b7280] mt-1 leading-relaxed">
                              {analise.prazo_descricao}
                            </p>
                          )}
                        </div>
                      </div>
                      {analise.fundamentacao && (
                        <div className="flex items-center gap-2 bg-white border border-[#e5e7eb] rounded-lg px-3 py-2">
                          <Scale size={11} className="text-[#9ca3af] shrink-0" />
                          <p className="text-[11px] text-[#6b7280] font-mono">{analise.fundamentacao}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-[#d1d5db] shrink-0" />
                      <p className="text-[13px] text-[#9ca3af] italic">
                        Nenhum prazo identificado nesta publicação
                      </p>
                    </div>
                  )}
                </div>

                {/* ── Bloco 3: Providência ── */}
                <div className="px-6 py-4">
                  <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ListTodo size={10} /> O que fazer
                  </p>
                  <p className="text-[13px] text-[#0f1923] leading-relaxed font-medium">
                    {analise.sugestao_acao}
                  </p>
                </div>

                {/* ── Bloco 4: Observações ── */}
                {analise.observacoes && (
                  <div className="px-6 py-4 bg-amber-50/40">
                    <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Info size={10} /> Atenção
                    </p>
                    <p className="text-[12px] text-amber-900 leading-relaxed">{analise.observacoes}</p>
                  </div>
                )}

              </div>

              {/* ── Providência preparada / Ações ── */}
              <div className="px-5 py-4 border-t border-[#f3f4f6] bg-[#fafbfc] space-y-3">

                {/* ── Estado: delegado com sucesso ── */}
                {delegado ? (
                  <div className="rounded-lg overflow-hidden border border-emerald-200">
                    <div className="bg-[#1D5F60] px-4 py-3 flex items-center gap-2.5">
                      <CheckCircle2 size={16} className="text-white shrink-0" />
                      <div>
                        <p className="text-[13px] font-bold text-white">Providência gerada!</p>
                        {delegado.responsavelNome && (
                          <p className="text-[11px] text-white/60">Delegada para {delegado.responsavelNome}</p>
                        )}
                      </div>
                    </div>
                    <div className="bg-white px-4 py-3 flex items-center gap-2 flex-wrap">
                      {delegado.kanban && (
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1D5F60] bg-[#E8F2F2] px-2.5 py-1 rounded-full">
                          <CheckCircle2 size={10} /> Card no Kanban
                        </span>
                      )}
                      {delegado.prazo && (
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
                          <CheckCircle2 size={10} /> Prazo na agenda
                        </span>
                      )}
                      <a
                        href="/kanban"
                        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-[#1D5F60] hover:bg-[#27777A] text-white text-[11px] font-semibold rounded-lg transition-colors"
                      >
                        Ver no Kanban <ArrowRight size={11} />
                      </a>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* ── Card de delegação rápida ── */}
                    <div className="bg-[#1D5F60]/[0.04] border border-[#0F3D3E]/20 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-1.5">
                        <Zap size={11} className="text-[#1D5F60]" />
                        <span className="text-[10px] font-bold text-[#1D5F60] uppercase tracking-wider">
                          Providência pronta para delegação
                        </span>
                      </div>

                      {/* Preview da tarefa */}
                      <div className="bg-white rounded-xl border border-[#e5e7eb] px-3.5 py-3 space-y-2">
                        <p className="text-[13px] font-semibold text-[#0f1923] leading-snug">
                          {analise.sugestao_acao}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full', urgCfg?.badge)}>
                            {urgCfg?.label}
                          </span>
                          {analise.prazo_data && (
                            <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full ring-1 ring-amber-200">
                              📅 {fmtDateShort(analise.prazo_data)}
                            </span>
                          )}
                          {analise.tipo_prazo && (
                            <span className="text-[9px] font-semibold text-[#1D5F60] bg-[#E8F2F2] px-2 py-0.5 rounded-full">
                              {analise.tipo_prazo}
                            </span>
                          )}
                          {analise.prazo_detectado && analise.prazo_data && (
                            <span className="text-[9px] text-[#9ca3af] bg-[#f3f4f6] px-2 py-0.5 rounded-full">
                              + prazo na agenda
                            </span>
                          )}
                        </div>
                        {analise.fundamentacao && (
                          <p className="text-[10px] font-mono text-[#9ca3af] truncate">
                            {analise.fundamentacao}
                          </p>
                        )}
                      </div>

                      {/* Responsável */}
                      <div className="flex items-center gap-2">
                        <User size={11} className="text-[#7a8899] shrink-0" />
                        <select
                          value={responsavelDelegacao}
                          onChange={e => setResponsavelDelegacao(e.target.value)}
                          className="flex-1 px-3 py-2 text-[12px] bg-white border border-[#e5e7eb] rounded-xl outline-none focus:border-[#1D5F60] text-[#374151] transition-all"
                        >
                          <option value="">— Sem responsável —</option>
                          {profiles.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                      </div>

                      {/* Botões */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowProvidencia(true)}
                          className="px-3 py-2 text-[12px] text-[#7a8899] border border-[#e5e7eb] bg-white rounded-xl hover:bg-[#f9fafb] transition-colors"
                        >
                          Personalizar
                        </button>
                        <button
                          onClick={delegarDireto}
                          disabled={delegando}
                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#1D5F60] hover:bg-[#27777A] text-white text-[13px] font-bold rounded-xl transition-colors disabled:opacity-40 shadow-sm"
                        >
                          {delegando
                            ? <><Loader2 size={13} className="animate-spin" /> Delegando…</>
                            : <><Zap size={13} /> Delegar agora</>
                          }
                        </button>
                      </div>
                    </div>

                    {/* Ações secundárias */}
                    <div className="flex flex-wrap gap-2">
                      {/* Gerar prazo */}
                      <button
                        onClick={criarPrazo}
                        disabled={!!criando || !analise.prazo_detectado}
                        title={!analise.prazo_detectado ? 'Nenhum prazo identificado' : undefined}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-all',
                          criado === 'prazo'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : !analise.prazo_detectado
                              ? 'border-[#e5e7eb] bg-[#f9fafb] text-[#d1d5db] cursor-not-allowed'
                              : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
                        )}
                      >
                        {criando === 'prazo' ? <Loader2 size={11} className="animate-spin" /> : <CalendarDays size={11} />}
                        {criado === 'prazo' ? 'Prazo criado!' : 'Só prazo'}
                      </button>

                      {/* Vincular processo */}
                      <button
                        onClick={() => setMostrarVincular(v => !v)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-[#e5e7eb] bg-white text-[#374151] hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 transition-all"
                      >
                        <Link2 size={11} />
                        {processoVinculado ? 'Alterar processo' : 'Vincular processo'}
                      </button>

                      {/* Copiar */}
                      <button
                        onClick={copiarAnalise}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb] transition-all"
                      >
                        {copiado ? <><Check size={11} className="text-emerald-600" /> Copiado!</> : <><Copy size={11} /> Copiar</>}
                      </button>

                      {/* Salvar (modo manual) */}
                      {modo === 'manual' && (
                        <button
                          onClick={() => salvarHistorico(analise)}
                          disabled={salvando || salvo}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-all',
                            salvo
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb]',
                          )}
                        >
                          {salvando ? <Loader2 size={11} className="animate-spin" /> : salvo ? <Check size={11} className="text-emerald-600" /> : <ClipboardCheck size={11} />}
                          {salvo ? 'Salva!' : 'Salvar análise'}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Modal de providência */}
    {showProvidencia && analise && (
      <ProvidenciaModal
        publicacaoId={pub?.id ?? `manual_${Date.now()}`}
        publicacaoTexto={pub?.resumo ?? textoManual}
        analise={analise}
        processoId={processoVinculadoId || null}
        processoNumero={processoVinculado?.numero_processo ?? pub?.numero_processo ?? null}
        processoTitulo={processoVinculado?.titulo ?? null}
        prazoData={analise.prazo_data}
        prazoDetectado={analise.prazo_detectado}
        currentUserId={userId}
        onClose={() => setShowProvidencia(false)}
        onDone={() => setCriado('tarefa')}
      />
    )}
    </>
  )
}
