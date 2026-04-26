'use client'

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import {
  ArrowLeft, FileText, Loader2, Copy, Check, Sparkles,
  ChevronDown, AlertTriangle, Shield, Zap, Clock,
  Send, History, ChevronRight, Printer, X,
  TrendingUp, Scale, Target, Info,
} from 'lucide-react'
import Link from 'next/link'
import { TIPOS_PECA } from '@/lib/ai/prompts'
import type { DadosProcesso, AnaliseEstrategica } from '@/lib/ai/prompts'
import { cn } from '@/lib/utils'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ProcessoItem {
  id:              string
  numero_processo: string | null
  titulo:          string
  area_direito:    string
  tribunal:        string | null
  vara:            string | null
  valor_causa:     number | null
  observacoes:     string | null
  cliente:         { id: string; nome: string } | null
  partes_processo: { id: string; pessoa_nome: string; tipo_parte: string }[]
}

interface PecaSalva {
  id:                  string
  tipo_peca_label:     string
  status:              string
  created_at:          string
  gerado_por:          { nome: string } | null
  revisao_comentario:  string | null
}

interface Props {
  processos:          ProcessoItem[]
  prazosPorProcesso:  Record<string, Array<{ titulo: string; data: string; tipo: string }>>
  advogadoNome:       string | null
  role:               string
}

const PARTES_CLIENTE = ['autor', 'requerente', 'exequente', 'reclamante', 'impetrante', 'paciente']

// ── Cores ─────────────────────────────────────────────────────────────────────

const RISCO_COR: Record<string, string> = {
  baixo:  'text-emerald-700 bg-emerald-50 border-emerald-200',
  medio:  'text-amber-700 bg-amber-50 border-amber-200',
  alto:   'text-orange-700 bg-orange-50 border-orange-200',
  critico:'text-red-700 bg-red-50 border-red-200',
}
const URGENCIA_COR: Record<string, string> = {
  normal:  'text-slate-600 bg-slate-50 border-slate-200',
  atencao: 'text-amber-700 bg-amber-50 border-amber-200',
  urgente: 'text-orange-700 bg-orange-50 border-orange-200',
  critica: 'text-red-700 bg-red-50 border-red-200',
}
const STATUS_COR: Record<string, string> = {
  rascunho: 'text-slate-600 bg-slate-100',
  revisao:  'text-amber-700 bg-amber-100',
  aprovada: 'text-emerald-700 bg-emerald-100',
  rejeitada:'text-red-700 bg-red-100',
}
const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho', revisao: 'Aguardando revisão',
  aprovada: 'Aprovada', rejeitada: 'Rejeitada',
}

// ── Visual Law renderer ───────────────────────────────────────────────────────

function renderizarPeca(texto: string): ReactNode {
  const linhas = texto.split('\n')
  return (
    <div className="space-y-0 font-serif leading-[1.85]">
      {linhas.map((linha, i) => {
        const t = linha.trim()
        if (!t) return <div key={i} className="h-3" />

        // Endereçamento
        if (/^(EXCELENTÍSSIMO|ILUSTRÍSSIMO|COLENDA|AO JUÍZO|À CÂMARA|AO TRIBUNAL|SENHOR DOUTOR)/i.test(t))
          return <p key={i} className="text-[13px] font-bold text-[#0f1923] uppercase tracking-wide text-center my-5">{t}</p>

        // Seção principal: I — DOS FATOS
        if (/^[IVX]+\s*[—–-]\s+[A-ZÁÉÍÓÚÀÂÊÎÔÛÃÕÇ]/.test(t))
          return (
            <div key={i} className="mt-7 mb-3">
              <h3 className="text-[13px] font-black text-[#0f1923] uppercase tracking-wider border-b-2 border-[#145A5B] pb-1.5">{t}</h3>
            </div>
          )

        // Subseção: A — DA RESPONSABILIDADE
        if (/^[A-Z]\s*[—–-]\s+[A-ZÁÉÍÓÚÀÂÊÎÔÛÃÕÇ]/.test(t))
          return (
            <div key={i} className="mt-5 mb-2">
              <h4 className="text-[12px] font-bold text-[#145A5B] uppercase tracking-wide">{t}</h4>
            </div>
          )

        // Alíneas de pedidos
        if (/^[a-z]\)|^\d+\)/.test(t))
          return (
            <div key={i} className="flex gap-2 my-2 pl-6">
              <span className="text-[13px] font-semibold text-[#145A5B] shrink-0 w-5">{t.slice(0, 2)}</span>
              <p className="text-[13px] text-[#374151]">{t.slice(2).trim()}</p>
            </div>
          )

        // [COMPLETAR]
        if (/^\[COMPLETAR/.test(t))
          return (
            <span key={i} className="inline-block my-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-[12px] font-semibold rounded border border-amber-300">{t}</span>
          )

        // Termos de fechamento
        if (/^(Termos em que|Nestes termos|E. deferimento|Pede deferimento)/i.test(t))
          return <p key={i} className="text-[13px] text-[#374151] mt-7 mb-1 italic">{t}</p>

        // Parágrafo normal
        return <p key={i} className="text-[13px] text-[#374151] my-1">{t}</p>
      })}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function PecaIA({ processos, prazosPorProcesso, advogadoNome: _advogadoNome, role }: Props) {
  const [processoId,     setProcessoId]     = useState('')
  const [tipoPeca,       setTipoPeca]       = useState('')
  const [instrucoes,     setInstrucoes]     = useState('')
  const [texto,          setTexto]          = useState('')
  const [loading,        setLoading]        = useState(false)
  const [loadingAnalise, setLoadingAnalise] = useState(false)
  const [analise,        setAnalise]        = useState<AnaliseEstrategica | null>(null)
  const [erro,           setErro]           = useState('')
  const [copiado,        setCopiado]        = useState(false)
  const [pecaId,         setPecaId]         = useState<string | null>(null)
  const [pecaStatus,     setPecaStatus]     = useState('rascunho')
  const [salvando,       setSalvando]       = useState(false)
  const [enviando,       setEnviando]       = useState(false)
  const [showHistorico,  setShowHistorico]  = useState(false)
  const [historico,      setHistorico]      = useState<PecaSalva[]>([])
  const [loadingHist,    setLoadingHist]    = useState(false)
  const [viewMode,       setViewMode]       = useState<'visual' | 'texto'>('visual')
  const [showRejeitar,   setShowRejeitar]   = useState(false)
  const [comentario,     setComentario]     = useState('')

  const resultRef = useRef<HTMLDivElement>(null)
  const processo  = processos.find(p => p.id === processoId) ?? null
  const prazos    = prazosPorProcesso[processoId] ?? []
  const podeRevisar = role === 'gerente' || role === 'socio'

  // Análise estratégica automática ao selecionar processo
  useEffect(() => {
    if (!processoId || !processo) { setAnalise(null); return }

    const partesContr = processo.partes_processo
      .filter(p => !PARTES_CLIENTE.includes(p.tipo_parte))
      .map(p => p.pessoa_nome)

    const dadosProcesso: DadosProcesso = {
      numero_processo:   processo.numero_processo,
      titulo:            processo.titulo,
      area_direito:      processo.area_direito,
      tribunal:          processo.tribunal,
      vara:              processo.vara,
      valor_causa:       processo.valor_causa,
      cliente_nome:      processo.cliente?.nome ?? null,
      partes_contrarias: partesContr,
      prazos_proximos:   prazos,
      observacoes:       processo.observacoes,
    }

    setLoadingAnalise(true)
    fetch('/api/ia/analise-estrategica', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ processo: dadosProcesso }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAnalise(data) })
      .catch(() => {})
      .finally(() => setLoadingAnalise(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processoId])

  const carregarHistorico = useCallback(async () => {
    if (!processoId) return
    setLoadingHist(true)
    try {
      const res = await fetch(`/api/ia/pecas?processo_id=${processoId}`)
      if (res.ok) setHistorico(await res.json())
    } finally { setLoadingHist(false) }
  }, [processoId])

  useEffect(() => { if (showHistorico) carregarHistorico() }, [showHistorico, carregarHistorico])

  async function gerar() {
    if (!tipoPeca || !processoId || !processo) { setErro('Selecione o processo e o tipo de peça'); return }
    setErro(''); setTexto(''); setLoading(true); setPecaId(null); setPecaStatus('rascunho')

    const partesContr = processo.partes_processo
      .filter(p => !PARTES_CLIENTE.includes(p.tipo_parte)).map(p => p.pessoa_nome)

    const dadosProcesso: DadosProcesso = {
      numero_processo:   processo.numero_processo,
      titulo:            processo.titulo,
      area_direito:      processo.area_direito,
      tribunal:          processo.tribunal,
      vara:              processo.vara,
      valor_causa:       processo.valor_causa,
      cliente_nome:      processo.cliente?.nome ?? null,
      partes_contrarias: partesContr,
      prazos_proximos:   prazos,
      observacoes:       processo.observacoes,
    }

    try {
      const res = await fetch('/api/ia/peca', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipoPeca, processo: dadosProcesso, instrucoes, analise }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); setErro(e.error ?? 'Erro ao gerar'); setLoading(false); return }

      const reader = res.body!.getReader()
      const dec    = new TextDecoder()
      let acc      = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += dec.decode(value, { stream: true })
        setTexto(acc)
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }

      // Auto-salvar rascunho
      setSalvando(true)
      const saveRes = await fetch('/api/ia/pecas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processo_id: processoId, tipo_peca: tipoPeca,
          tipo_peca_label: TIPOS_PECA.find(t => t.value === tipoPeca)?.label ?? tipoPeca,
          conteudo: acc, instrucoes, analise_estrategica: analise,
        }),
      })
      if (saveRes.ok) { const d = await saveRes.json(); setPecaId(d.id) }
      setSalvando(false)
    } catch { setErro('Erro de conexão.') }
    finally { setLoading(false) }
  }

  async function enviarRevisao() {
    if (!pecaId) return
    setEnviando(true)
    try {
      const res = await fetch(`/api/ia/pecas/${pecaId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'revisao' }),
      })
      if (res.ok) { setPecaStatus('revisao'); carregarHistorico() }
    } finally { setEnviando(false) }
  }

  async function aprovar() {
    if (!pecaId) return
    const r = await fetch(`/api/ia/pecas/${pecaId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'aprovada' }),
    })
    if (r.ok) { setPecaStatus('aprovada'); carregarHistorico() }
  }

  async function rejeitar() {
    if (!pecaId || !comentario) return
    const r = await fetch(`/api/ia/pecas/${pecaId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejeitada', comentario }),
    })
    if (r.ok) { setPecaStatus('rejeitada'); setShowRejeitar(false); carregarHistorico() }
  }

  async function copiar() {
    await navigator.clipboard.writeText(texto)
    setCopiado(true); setTimeout(() => setCopiado(false), 2000)
  }

  const tipoLabel = TIPOS_PECA.find(t => t.value === tipoPeca)?.label

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-[1400px]">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Link href="/ia-juridica" className="p-2 rounded-xl text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-[20px] font-semibold text-[#0f1923] flex items-center gap-2">
            <FileText size={18} className="text-[#145A5B]" />
            Gerar Peça Jurídica
            <span className="text-[10px] font-bold text-[#145A5B] bg-[#E8F0F0] px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={8} /> Premium
            </span>
          </h1>
          <p className="text-[12px] text-[#7a8899] mt-0.5">Análise estratégica automática · Visual Law · Histórico por processo</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-5 items-start">

        {/* ── Painel esquerdo ─────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Configuração */}
          <div className="bg-white rounded-2xl border border-[#D0DCDC] p-5 space-y-4">
            <p className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider">Configuração</p>

            <Sel label="Tipo de peça" required value={tipoPeca} onChange={setTipoPeca}>
              <option value="">Selecione o tipo…</option>
              {TIPOS_PECA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Sel>

            <Sel label="Processo" required value={processoId}
              onChange={v => { setProcessoId(v); setTexto(''); setPecaId(null); setAnalise(null) }}>
              <option value="">Selecione o processo…</option>
              {processos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.numero_processo ? `${p.numero_processo} — ` : ''}{p.titulo}
                </option>
              ))}
            </Sel>

            <div>
              <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                Instruções adicionais <span className="font-normal text-[#9ca3af]">(opcional)</span>
              </label>
              <textarea value={instrucoes} onChange={e => setInstrucoes(e.target.value)} rows={3}
                placeholder="Ex: enfatizar o dano moral; incluir pedido de tutela de urgência…"
                className="w-full px-3 py-2.5 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-[#145A5B] text-[#1a1d23] placeholder:text-[#c5cdd8] resize-none transition-all" />
            </div>

            {erro && (
              <div className="flex items-center gap-1.5 text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                <AlertTriangle size={12} /> {erro}
              </div>
            )}

            <button onClick={gerar} disabled={loading || !tipoPeca || !processoId}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-[#0F3D3E] hover:bg-[#145A5B] text-white text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {loading ? 'Gerando peça…' : `Gerar ${tipoLabel ?? 'Peça'}`}
            </button>
          </div>

          {/* Dados do processo */}
          {processo && (
            <div className="bg-white rounded-2xl border border-[#D0DCDC] p-5 space-y-2.5">
              <p className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider">Dados do Processo</p>
              <CampoInfo label="Cliente"        valor={processo.cliente?.nome} />
              <CampoInfo label="Parte contrária" valor={processo.partes_processo.filter(p => !PARTES_CLIENTE.includes(p.tipo_parte)).map(p => p.pessoa_nome).join(', ')} />
              <CampoInfo label="Área"           valor={processo.area_direito} />
              <CampoInfo label="Tribunal"       valor={processo.tribunal} />
              <CampoInfo label="Vara"           valor={processo.vara} />
              <CampoInfo label="Valor da causa" valor={processo.valor_causa ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(processo.valor_causa) : undefined} />
              {prazos.length > 0 && (
                <div className="pt-2 border-t border-[#f3f4f6]">
                  <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Clock size={9} /> Prazos próximos
                  </p>
                  {prazos.slice(0, 4).map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] mb-1">
                      <span className="text-amber-600 font-mono shrink-0 text-[10px]">{p.data}</span>
                      <span className="text-[#374151] truncate">{p.titulo}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Análise estratégica */}
          {processoId && (
            <div className="bg-white rounded-2xl border border-[#D0DCDC] p-5 space-y-3">
              <p className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider flex items-center gap-1.5">
                <Target size={11} /> Análise Estratégica
              </p>

              {loadingAnalise && (
                <div className="flex items-center gap-2 text-[12px] text-[#9ca3af] py-2">
                  <Loader2 size={13} className="animate-spin text-[#145A5B]" /> Analisando o caso…
                </div>
              )}

              {!loadingAnalise && !analise && (
                <p className="text-[12px] text-[#9ca3af]">Análise indisponível.</p>
              )}

              {analise && !loadingAnalise && (
                <div className="space-y-3">
                  <p className="text-[12px] text-[#374151] leading-relaxed bg-[#f9fafb] rounded-xl p-3 border border-[#f3f4f6]">
                    {analise.diagnostico}
                  </p>

                  <div className="flex gap-2 flex-wrap">
                    <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1', RISCO_COR[analise.nivel_risco])}>
                      <Shield size={9} />
                      {analise.nivel_risco.charAt(0).toUpperCase() + analise.nivel_risco.slice(1)}
                    </span>
                    <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1', URGENCIA_COR[analise.urgencia])}>
                      <Zap size={9} />
                      {analise.urgencia.charAt(0).toUpperCase() + analise.urgencia.slice(1)}
                    </span>
                  </div>

                  {analise.prazo_fatal && (
                    <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl">
                      <AlertTriangle size={12} className="text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-bold text-red-800">Prazo Fatal: {analise.prazo_fatal}</p>
                        <p className="text-[11px] text-red-700">{analise.prazo_descricao}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2 p-2.5 bg-[#E8F0F0] rounded-xl">
                    <TrendingUp size={12} className="text-[#145A5B] shrink-0 mt-0.5" />
                    <p className="text-[11px] text-[#145A5B] font-medium leading-relaxed">{analise.proxima_acao}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1">Estratégia</p>
                    <p className="text-[12px] text-[#374151] leading-relaxed">{analise.estrategia_recomendada}</p>
                  </div>

                  {analise.teses_juridicas.length > 0 && analise.teses_juridicas[0] !== 'Não identificado' && (
                    <div>
                      <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1.5">Teses Aplicáveis</p>
                      <ul className="space-y-1">
                        {analise.teses_juridicas.map((t, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[11px] text-[#374151]">
                            <Scale size={9} className="text-[#145A5B] shrink-0 mt-0.5" /> {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Painel direito: peça ────────────────────────────────────── */}
        <div className="space-y-4">

          {(loading || texto) ? (
            <div ref={resultRef} className="bg-white rounded-2xl border border-[#D0DCDC] overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.06)]">

              {/* Toolbar */}
              <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-[#f9fafb] border-b border-[#f3f4f6] flex-wrap">
                <div className="flex items-center gap-2.5">
                  <FileText size={15} className="text-[#145A5B]" />
                  <div>
                    <p className="text-[13px] font-semibold text-[#0f1923] flex items-center gap-2">
                      {tipoLabel ?? 'Peça'}
                      {loading && <Loader2 size={12} className="animate-spin text-[#9ca3af]" />}
                      {salvando && <span className="text-[11px] text-[#9ca3af] font-normal">Salvando…</span>}
                    </p>
                    {pecaId && (
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', STATUS_COR[pecaStatus])}>
                        {STATUS_LABEL[pecaStatus]}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {texto && !loading && (
                    <>
                      <div className="flex rounded-lg border border-[#e5e7eb] overflow-hidden">
                        {(['visual', 'texto'] as const).map(m => (
                          <button key={m} onClick={() => setViewMode(m)}
                            className={cn('px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                              viewMode === m ? 'bg-[#145A5B] text-white' : 'bg-white text-[#6b7280] hover:bg-[#f9fafb]')}>
                            {m.charAt(0).toUpperCase() + m.slice(1)}
                          </button>
                        ))}
                      </div>
                      <button onClick={copiar} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#374151] border border-[#e5e7eb] rounded-lg hover:bg-[#f9fafb] transition-colors">
                        {copiado ? <><Check size={12} className="text-emerald-600" /> Copiado</> : <><Copy size={12} /> Copiar</>}
                      </button>
                      <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#374151] border border-[#e5e7eb] rounded-lg hover:bg-[#f9fafb] transition-colors">
                        <Printer size={12} /> Imprimir
                      </button>
                    </>
                  )}

                  {pecaId && !loading && (
                    <>
                      {pecaStatus === 'rascunho' && (
                        <button onClick={enviarRevisao} disabled={enviando}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-amber-700 border border-amber-300 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50">
                          {enviando ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                          Enviar para revisão
                        </button>
                      )}
                      {pecaStatus === 'revisao' && podeRevisar && (
                        <>
                          <button onClick={aprovar}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-emerald-700 border border-emerald-300 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors">
                            <Check size={12} /> Aprovar
                          </button>
                          <button onClick={() => setShowRejeitar(v => !v)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-red-700 border border-red-300 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                            <X size={12} /> Rejeitar
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Rejeição */}
              {showRejeitar && (
                <div className="px-5 py-3 bg-red-50 border-b border-red-200 space-y-2">
                  <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={2}
                    placeholder="Descreva o que precisa ser corrigido…"
                    className="w-full px-3 py-2 text-[12px] border border-red-200 rounded-lg outline-none bg-white resize-none" />
                  <div className="flex gap-2">
                    <button onClick={rejeitar} disabled={!comentario}
                      className="px-3 py-1.5 text-[12px] font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                      Confirmar rejeição
                    </button>
                    <button onClick={() => setShowRejeitar(false)}
                      className="px-3 py-1.5 text-[12px] text-[#6b7280] rounded-lg hover:bg-red-100">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Conteúdo */}
              <div className="px-8 py-8 min-h-[400px]">
                {viewMode === 'visual'
                  ? renderizarPeca(texto)
                  : <pre className="whitespace-pre-wrap text-[13px] text-[#374151] leading-relaxed font-mono">{texto}
                      {loading && <span className="inline-block w-1.5 h-4 bg-[#145A5B] ml-0.5 animate-pulse rounded-sm" />}
                    </pre>}
                {loading && !texto && (
                  <div className="flex items-center gap-2 text-[13px] text-[#9ca3af]">
                    <Loader2 size={14} className="animate-spin text-[#145A5B]" /> Redigindo a peça…
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Estado inicial */
            <div className="bg-white rounded-2xl border border-[#D0DCDC] p-16 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 bg-[#f0f7f7] rounded-2xl flex items-center justify-center">
                <FileText size={28} className="text-[#D0DCDC]" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#374151]">A peça aparecerá aqui</p>
                <p className="text-[12px] text-[#9ca3af] mt-1">Selecione o processo, escolha o tipo e clique em Gerar</p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#9ca3af] bg-[#f9fafb] px-3 py-2 rounded-lg">
                <Info size={11} />
                Análise estratégica carregada automaticamente ao selecionar o processo
              </div>
            </div>
          )}

          {/* Histórico */}
          {processoId && (
            <div className="bg-white rounded-2xl border border-[#D0DCDC] overflow-hidden">
              <button onClick={() => setShowHistorico(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3.5 bg-[#f9fafb] hover:bg-[#f3f4f6] transition-colors text-left">
                <p className="text-[12px] font-semibold text-[#374151] flex items-center gap-1.5">
                  <History size={13} className="text-[#9ca3af]" /> Histórico de peças deste processo
                </p>
                {showHistorico ? <ChevronDown size={13} className="text-[#9ca3af]" /> : <ChevronRight size={13} className="text-[#9ca3af]" />}
              </button>

              {showHistorico && (
                <div className="divide-y divide-[#f9fafb]">
                  {loadingHist && <div className="px-5 py-4 text-[12px] text-[#9ca3af] flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Carregando…</div>}
                  {!loadingHist && historico.length === 0 && <p className="px-5 py-4 text-[12px] text-[#9ca3af]">Nenhuma peça gerada ainda.</p>}
                  {historico.map(h => (
                    <div key={h.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[#fafafa]">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[#0f1923] truncate">{h.tipo_peca_label}</p>
                        <p className="text-[11px] text-[#9ca3af]">
                          {h.gerado_por?.nome ?? 'Sistema'} · {new Date(h.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {h.revisao_comentario && <p className="text-[11px] text-red-600 mt-0.5 italic">"{h.revisao_comentario}"</p>}
                      </div>
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0', STATUS_COR[h.status])}>
                        {STATUS_LABEL[h.status] ?? h.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Primitivos ────────────────────────────────────────────────────────────────

function Sel({ label, required, value, onChange, children }: {
  label: string; required?: boolean; value: string
  onChange: (v: string) => void; children: ReactNode
}) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2.5 pr-8 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl appearance-none outline-none focus:bg-white focus:border-[#145A5B] text-[#1a1d23] transition-all">
          {children}
        </select>
        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" />
      </div>
    </div>
  )
}

function CampoInfo({ label, valor }: { label: string; valor?: string | null }) {
  return (
    <div className="flex justify-between gap-2 text-[12px]">
      <span className="text-[#9ca3af] shrink-0">{label}</span>
      <span className={cn('text-right', valor ? 'text-[#374151] font-medium' : 'text-[#c5cdd8] italic')}>
        {valor || '—'}
      </span>
    </div>
  )
}
