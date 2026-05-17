'use client'

import { useState, useRef } from 'react'
import { ArrowLeft, FileText, Loader2, Copy, Check, ChevronDown, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { TIPOS_PECA } from '@/lib/ai/prompts'
import type { DadosProcesso } from '@/lib/ai/prompts'
import { cn } from '@/lib/utils'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ProcessoItem {
  id: string
  numero_processo: string | null
  titulo: string
  area_direito: string
  tribunal: string | null
  vara: string | null
  valor_causa: number | null
  cliente: { id: string; nome: string } | null
  partes_processo: { id: string; pessoa_nome: string; tipo_parte: string }[]
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function PecaIA({ processos }: { processos: ProcessoItem[] }) {
  const [processoId,  setProcessoId]  = useState('')
  const [tipoPeca,    setTipoPeca]    = useState('')
  const [instrucoes,  setInstrucoes]  = useState('')
  const [texto,       setTexto]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [erro,        setErro]        = useState('')
  const [copiado,     setCopiado]     = useState(false)

  const resultRef = useRef<HTMLDivElement>(null)

  const processo = processos.find(p => p.id === processoId) ?? null

  async function gerar() {
    if (!tipoPeca)    { setErro('Selecione o tipo de peça'); return }
    if (!processoId)  { setErro('Selecione o processo'); return }

    setErro('')
    setTexto('')
    setLoading(true)

    // Partes do lado oposto ao cliente (excluir autor/requerente/exequente/reclamante)
    const PARTES_CLIENTE = ['autor', 'requerente', 'exequente', 'reclamante', 'impetrante', 'paciente']
    const partesContrar  = processo!.partes_processo
      .filter(p => !PARTES_CLIENTE.includes(p.tipo_parte))
      .map(p => p.pessoa_nome)

    const dadosProcesso: DadosProcesso = {
      numero_processo:   processo!.numero_processo,
      titulo:            processo!.titulo,
      area_direito:      processo!.area_direito,
      tribunal:          processo!.tribunal,
      vara:              processo!.vara,
      valor_causa:       processo!.valor_causa,
      cliente_nome:      processo!.cliente?.nome ?? null,
      partes_contrarias: partesContrar,
    }

    try {
      const res = await fetch('/api/ia/peca', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tipoPeca, processo: dadosProcesso, instrucoes }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        setErro(err.error ?? 'Erro ao gerar peça')
        setLoading(false)
        return
      }

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setTexto(prev => prev + decoder.decode(value, { stream: true }))
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }
    } catch {
      setErro('Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function copiar() {
    await navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const tipoLabel = TIPOS_PECA.find(t => t.value === tipoPeca)?.label

  return (
    <div className="space-y-5 max-w-4xl">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Link href="/ia-juridica" className="p-2 rounded-xl text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-[20px] font-semibold text-[#0f1923] tracking-tight flex items-center gap-2">
            <FileText size={18} className="text-[#1D5F60]" />
            Gerar Peça Jurídica
          </h1>
          <p className="text-[12px] text-[#7a8899] mt-0.5">Selecione o processo e o tipo de documento</p>
        </div>
      </div>

      {/* Formulário */}
      <div className="bg-white rounded-lg border border-[#E2DDD8] p-6 space-y-5">

        {/* Tipo de peça */}
        <div>
          <label className="block text-[12px] font-semibold text-[#374151] mb-2">
            Tipo de peça <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              value={tipoPeca}
              onChange={e => { setTipoPeca(e.target.value); setErro('') }}
              className="w-full px-3 py-2.5 pr-9 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl appearance-none outline-none focus:bg-white focus:border-[#1D5F60] text-[#1a1d23] transition-all"
            >
              <option value="">Selecione o tipo de peça…</option>
              {TIPOS_PECA.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" />
          </div>
        </div>

        {/* Processo */}
        <div>
          <label className="block text-[12px] font-semibold text-[#374151] mb-2">
            Processo <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              value={processoId}
              onChange={e => { setProcessoId(e.target.value); setErro('') }}
              className="w-full px-3 py-2.5 pr-9 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl appearance-none outline-none focus:bg-white focus:border-[#1D5F60] text-[#1a1d23] transition-all"
            >
              <option value="">Selecione o processo…</option>
              {processos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.numero_processo ? `${p.numero_processo} — ` : ''}{p.titulo}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" />
          </div>
        </div>

        {/* Dados carregados do processo */}
        {processo && (
          <div className="bg-[#f9fafb] rounded-xl p-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
            <DataItem label="Cliente"       value={processo.cliente?.nome} />
            <DataItem label="Área"          value={processo.area_direito} />
            <DataItem label="Tribunal"      value={processo.tribunal} />
            <DataItem label="Vara"          value={processo.vara} />
            <DataItem
              label="Valor da causa"
              value={processo.valor_causa
                ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(processo.valor_causa)
                : undefined}
            />
            <DataItem
              label="Parte contrária"
              value={processo.partes_processo.length > 0
                ? processo.partes_processo.map(p => p.pessoa_nome).join(', ')
                : undefined}
            />
          </div>
        )}

        {/* Instruções adicionais */}
        <div>
          <label className="block text-[12px] font-semibold text-[#374151] mb-2">
            Instruções adicionais{' '}
            <span className="font-normal text-[#9ca3af]">(opcional — ex: tese específica, fatos relevantes)</span>
          </label>
          <textarea
            value={instrucoes}
            onChange={e => setInstrucoes(e.target.value)}
            rows={3}
            placeholder="Ex: enfatizar o dano moral; incluir pedido de tutela de urgência; mencionar que o cliente é aposentado…"
            className="w-full px-3 py-2.5 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-[#1D5F60] text-[#1a1d23] placeholder:text-[#c5cdd8] resize-none transition-all"
          />
        </div>

        {erro && (
          <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>
        )}

        <button
          onClick={gerar}
          disabled={loading || !tipoPeca || !processoId}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#1D5F60] hover:bg-[#27777A] text-white text-[13px] font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {loading ? 'Gerando…' : `Gerar ${tipoLabel ?? 'Peça'}`}
        </button>
      </div>

      {/* Resultado */}
      {(loading || texto) && (
        <div ref={resultRef} className="bg-white rounded-lg border border-[#E2DDD8] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#f3f4f6]">
            <h2 className="text-[13px] font-semibold text-[#1a1d23] flex items-center gap-2">
              <FileText size={14} className="text-[#1D5F60]" />
              {tipoLabel ?? 'Peça gerada'}
              {loading && <Loader2 size={12} className="animate-spin text-[#9ca3af] ml-1" />}
            </h2>
            {texto && !loading && (
              <button
                onClick={copiar}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#374151] border border-[#e5e7eb] rounded-lg hover:bg-[#f9fafb] transition-colors"
              >
                {copiado ? <><Check size={12} className="text-green-600" /> Copiado!</> : <><Copy size={12} /> Copiar</>}
              </button>
            )}
          </div>
          <div className="px-6 py-5">
            <pre className="whitespace-pre-wrap text-[13px] text-[#374151] leading-relaxed font-sans">
              {texto}
              {loading && <span className="inline-block w-1.5 h-4 bg-[#145A5B] ml-0.5 animate-pulse rounded-sm" />}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

function DataItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">{label}</span>
      <span className={cn('text-[12px]', value ? 'text-[#374151]' : 'text-[#c5cdd8] italic')}>
        {value ?? '—'}
      </span>
    </div>
  )
}
