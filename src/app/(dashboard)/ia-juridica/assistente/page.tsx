'use client'

import { useState, useRef, useEffect } from 'react'
import {
  ArrowLeft, Bot, Loader2, Send, Copy, Check,
  ChevronDown, Sparkles, RotateCcw,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { DadosProcesso } from '@/lib/ai/prompts'

interface ProcessoOpcao {
  id: string
  numero_processo: string | null
  titulo: string
  area_direito: string
  tribunal: string | null
  vara: string | null
  valor_causa: number | null
  cliente: { nome: string } | null
  partes_processo: { pessoa_nome: string }[]
}

interface Mensagem {
  id:        string
  role:      'user' | 'assistant'
  content:   string
  loading?:  boolean
}

export default function AssistenteJuridico() {
  const [processos,    setProcessos]    = useState<ProcessoOpcao[]>([])
  const [processoId,   setProcessoId]   = useState('')
  const [pergunta,     setPergunta]     = useState('')
  const [mensagens,    setMensagens]    = useState<Mensagem[]>([])
  const [loading,      setLoading]      = useState(false)
  const [copiado,      setCopiado]      = useState<string | null>(null)
  const [carregandoProc, setCarregandoProc] = useState(false)

  const bottomRef    = useRef<HTMLDivElement>(null)
  const textareaRef  = useRef<HTMLTextAreaElement>(null)

  // Carrega processos ao montar
  useEffect(() => {
    async function load() {
      setCarregandoProc(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('processos')
        .select('id, numero_processo, titulo, area_direito, tribunal, vara, valor_causa, cliente:clientes(nome), partes_processo(pessoa_nome)')
        .in('status', ['ativo', 'suspenso'])
        .order('titulo')
        .limit(200)
      setProcessos((data ?? []) as unknown as ProcessoOpcao[])
      setCarregandoProc(false)
    }
    load()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  const processo = processos.find(p => p.id === processoId) ?? null

  async function enviar() {
    const q = pergunta.trim()
    if (!q || loading) return

    const msgId = Date.now().toString()
    const asstId = msgId + '_r'

    const userMsg:  Mensagem = { id: msgId,  role: 'user',      content: q }
    const asstMsg:  Mensagem = { id: asstId, role: 'assistant', content: '', loading: true }

    setMensagens(prev => [...prev, userMsg, asstMsg])
    setPergunta('')
    setLoading(true)

    let contexto: DadosProcesso | undefined
    if (processo) {
      contexto = {
        numero_processo:   processo.numero_processo,
        titulo:            processo.titulo,
        area_direito:      processo.area_direito,
        tribunal:          processo.tribunal,
        vara:              processo.vara,
        valor_causa:       processo.valor_causa,
        cliente_nome:      processo.cliente?.nome ?? null,
        partes_contrarias: processo.partes_processo.map(p => p.pessoa_nome),
      }
    }

    try {
      const res = await fetch('/api/ia/assistente', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pergunta: q, contextoProcesso: contexto }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        setMensagens(prev => prev.map(m =>
          m.id === asstId ? { ...m, content: `Erro: ${err.error}`, loading: false } : m
        ))
        return
      }

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let acc = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setMensagens(prev => prev.map(m =>
          m.id === asstId ? { ...m, content: acc } : m
        ))
      }

      setMensagens(prev => prev.map(m =>
        m.id === asstId ? { ...m, loading: false } : m
      ))
    } catch {
      setMensagens(prev => prev.map(m =>
        m.id === asstId ? { ...m, content: 'Erro de conexão. Tente novamente.', loading: false } : m
      ))
    } finally {
      setLoading(false)
    }
  }

  async function copiar(id: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopiado(id)
    setTimeout(() => setCopiado(null), 2000)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-3xl space-y-0">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3 pb-4">
        <Link href="/ia-juridica" className="p-2 rounded-xl text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-[20px] font-semibold text-[#0f1923] tracking-tight flex items-center gap-2">
            <Bot size={18} className="text-amber-500" />
            Assistente Jurídico
          </h1>
          <p className="text-[12px] text-[#7a8899] mt-0.5">Perguntas em linguagem natural — com ou sem contexto de processo</p>
        </div>
        {mensagens.length > 0 && (
          <button
            onClick={() => setMensagens([])}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[#7a8899] hover:text-[#374151] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-all"
          >
            <RotateCcw size={12} /> Limpar
          </button>
        )}
      </div>

      {/* Contexto de processo (opcional) */}
      <div className="bg-white rounded-lg border border-[#E2DDD8] px-4 py-3 mb-3">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider shrink-0">
            Contexto
          </span>
          <div className="relative flex-1">
            <select
              value={processoId}
              onChange={e => setProcessoId(e.target.value)}
              disabled={carregandoProc}
              className="w-full px-3 py-1.5 pr-8 text-[12px] bg-[#f9fafb] border border-[#e5e7eb] rounded-lg appearance-none outline-none focus:bg-white focus:border-amber-400 text-[#374151] transition-all"
            >
              <option value="">Sem contexto de processo (pergunta geral)</option>
              {processos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.numero_processo ? `${p.numero_processo} — ` : ''}{p.titulo}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" />
          </div>
        </div>
        {processo && (
          <p className="text-[11px] text-[#9ca3af] mt-1.5 pl-[68px]">
            {processo.area_direito} · {processo.tribunal ?? 'Tribunal n/d'} ·{' '}
            {processo.cliente?.nome ?? 'Cliente n/d'}
          </p>
        )}
      </div>

      {/* Histórico de mensagens */}
      <div className="flex-1 overflow-y-auto space-y-4 px-1 pb-4">

        {mensagens.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
            <div className="w-14 h-14 rounded-lg bg-amber-50 flex items-center justify-center">
              <Sparkles size={22} className="text-amber-500" />
            </div>
            <p className="text-[14px] font-medium text-[#374151]">Como posso ajudar?</p>
            <p className="text-[12px] text-[#9ca3af] max-w-xs leading-relaxed">
              Faça perguntas jurídicas, peça resumos de institutos, questione sobre prazos, competências ou estratégias processuais.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {[
                'Quais são os requisitos da tutela de urgência?',
                'Quando cabe agravo de instrumento?',
                'Explique a prescrição intercorrente',
              ].map(sugestao => (
                <button
                  key={sugestao}
                  onClick={() => { setPergunta(sugestao); textareaRef.current?.focus() }}
                  className="text-[11px] text-[#6b7280] bg-[#f9fafb] border border-[#e5e7eb] px-3 py-1.5 rounded-full hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-all"
                >
                  {sugestao}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensagens.map(msg => (
          <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                <Bot size={13} className="text-amber-600" />
              </div>
            )}
            <div className={cn(
              'relative max-w-[85%] rounded-lg px-4 py-3 group',
              msg.role === 'user'
                ? 'bg-[#1D5F60] text-white rounded-tr-sm'
                : 'bg-white border border-[#e5e7eb] text-[#374151] rounded-tl-sm shadow-sm',
            )}>
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
                {msg.content}
                {msg.loading && (
                  <span className="inline-flex items-center gap-1 ml-1">
                    <span className="w-1 h-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                )}
              </p>
              {msg.role === 'assistant' && !msg.loading && msg.content && (
                <button
                  onClick={() => copiar(msg.id, msg.content)}
                  className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-[#c5cdd8] hover:text-[#6b7280]"
                >
                  {copiado === msg.id ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                </button>
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white rounded-lg border border-[#E2DDD8] p-3 flex items-end gap-2 mt-auto">
        <textarea
          ref={textareaRef}
          value={pergunta}
          onChange={e => setPergunta(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
          rows={2}
          placeholder="Digite sua pergunta jurídica… (Enter para enviar, Shift+Enter para nova linha)"
          className="flex-1 text-[13px] bg-transparent outline-none resize-none text-[#1a1d23] placeholder:text-[#c5cdd8] leading-relaxed"
          style={{ maxHeight: 120 }}
        />
        <button
          onClick={enviar}
          disabled={loading || !pergunta.trim()}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </div>

    </div>
  )
}
