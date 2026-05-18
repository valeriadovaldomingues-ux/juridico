'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Bot, Check, Copy, Loader2, RotateCcw, Send, ShieldCheck, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type MensagemRole = 'user' | 'assistant'

interface Mensagem {
  id: string
  role: MensagemRole
  content: string
  loading?: boolean
}

const SUGESTOES = [
  'Resuma esta demanda',
  'Classifique a urgência',
  'Monte um plano de ação',
  'Revise esta minuta',
  'Liste riscos e providências',
]

const IS_DEV = process.env.NODE_ENV === 'development'

function makeMessageId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Erro desconhecido'
}

export default function AuroraPage() {
  const [mensagem, setMensagem] = useState('')
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [loading, setLoading] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  async function enviar(texto?: string) {
    const conteudo = (texto ?? mensagem).trim()
    if (!conteudo || loading) return

    const msgId = makeMessageId()
    const asstId = makeMessageId()
    const historico = mensagens
      .filter(msg => !msg.loading && msg.content.trim())
      .map(msg => ({ role: msg.role, content: msg.content }))

    setMensagens(prev => [
      ...prev,
      { id: msgId, role: 'user', content: conteudo },
      { id: asstId, role: 'assistant', content: '', loading: true },
    ])
    setMensagem('')
    setLoading(true)

    try {
      if (IS_DEV) {
        console.info('[Aurora] chamando API', {
          endpoint: '/api/ia/aurora',
          historico: historico.length,
        })
      }

      const res = await fetch('/api/ia/aurora', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: conteudo, historico }),
      })

      if (IS_DEV) {
        console.info('[Aurora] resposta da API', {
          status: res.status,
          ok: res.ok,
          contentType: res.headers.get('content-type'),
        })
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        setMensagens(prev => prev.map(msg =>
          msg.id === asstId ? { ...msg, content: `Erro: ${err.error}`, loading: false } : msg
        ))
        return
      }

      const contentType = res.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const data = await res.json().catch(() => ({ error: 'Resposta JSON inválida da Aurora' }))
        const resposta = typeof data.resposta === 'string' ? data.resposta : ''
        const erro = typeof data.error === 'string' ? data.error : ''
        const aviso = IS_DEV && typeof data.aviso === 'string' ? `\n\n[dev] ${data.aviso}` : ''

        setMensagens(prev => prev.map(msg =>
          msg.id === asstId
            ? { ...msg, content: resposta ? `${resposta}${aviso}` : `Erro: ${erro || 'Resposta vazia da Aurora.'}`, loading: false }
            : msg
        ))
        return
      }

      if (!res.body) {
        setMensagens(prev => prev.map(msg =>
          msg.id === asstId ? { ...msg, content: 'Resposta vazia da Aurora.', loading: false } : msg
        ))
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setMensagens(prev => prev.map(msg =>
          msg.id === asstId ? { ...msg, content: acc } : msg
        ))
      }

      setMensagens(prev => prev.map(msg =>
        msg.id === asstId ? { ...msg, loading: false } : msg
      ))
    } catch (error) {
      if (IS_DEV) {
        console.error('[Aurora] erro no envio', error)
      }
      const detail = getErrorMessage(error)
      const content = IS_DEV
        ? `Erro de conexão. Detalhe técnico: ${detail}`
        : 'Erro de conexão. Tente novamente.'
      setMensagens(prev => prev.map(msg =>
        msg.id === asstId
          ? { ...msg, content, loading: false }
          : msg
      ))
    } finally {
      setLoading(false)
    }
  }

  async function copiar(id: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopiado(id)
    setTimeout(() => setCopiado(null), 1800)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  return (
    <div className="min-h-[calc(100vh-104px)] max-w-6xl pr-2">
      <div
        className="rounded-2xl border overflow-hidden"
        style={{
          borderColor: 'rgba(196,149,87,0.24)',
          background:
            'linear-gradient(135deg, rgba(8,20,34,0.98), rgba(11,28,45,0.96) 52%, rgba(17,24,39,0.98))',
          boxShadow: '0 18px 50px rgba(15,25,35,0.16)',
        }}
      >
        <header
          className="px-6 py-5 border-b flex items-start justify-between gap-5"
          style={{ borderColor: 'rgba(196,149,87,0.18)' }}
        >
          <div className="flex items-start gap-4 min-w-0">
            <Link
              href="/ia-juridica"
              className="mt-1 p-2 rounded-xl text-white/[0.45] hover:text-white hover:bg-white/[0.08] transition-colors"
              aria-label="Voltar para IA Jurídica"
            >
              <ArrowLeft size={16} />
            </Link>
            <div className="flex items-start gap-4 min-w-0">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(196,149,87,0.14)', color: '#C49557' }}
              >
                <Sparkles size={21} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-[28px] font-semibold tracking-tight text-[#F7F0E8] leading-tight">
                    Aurora
                  </h1>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{ borderColor: 'rgba(196,149,87,0.35)', color: '#C49557' }}
                  >
                    <ShieldCheck size={11} />
                    Acesso exclusivo aos sócios
                  </span>
                </div>
                <p className="mt-1 text-[14px] text-white/[0.58]">
                  Assistente executiva jurídica dos sócios
                </p>
              </div>
            </div>
          </div>

          {mensagens.length > 0 && (
            <button
              onClick={() => setMensagens([])}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[12px] font-medium text-white/[0.55] hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <RotateCcw size={13} />
              Limpar
            </button>
          )}
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] min-h-[calc(100vh-220px)]">
          <section className="flex flex-col min-h-[620px] border-r border-white/[0.08]">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {mensagens.length === 0 && (
                <div className="h-full min-h-[420px] flex flex-col justify-center">
                  <div className="max-w-2xl">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#C49557]">
                      Pessoa e do Val Advocacia
                    </p>
                    <h2 className="mt-3 text-[24px] font-semibold text-[#F7F0E8] tracking-tight">
                      Apoio executivo para decisões jurídicas e estratégicas.
                    </h2>
                    <p className="mt-3 text-[14px] leading-relaxed text-white/[0.55]">
                      Traga uma demanda, minuta, risco, contexto de reunião ou conjunto de providências.
                      A Aurora organizará a análise para revisão dos sócios.
                    </p>
                  </div>
                </div>
              )}

              {mensagens.map(msg => (
                <div
                  key={msg.id}
                  className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  {msg.role === 'assistant' && (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mr-3 mt-1"
                      style={{ background: 'rgba(196,149,87,0.16)', color: '#C49557' }}
                    >
                      <Bot size={15} />
                    </div>
                  )}
                  <div
                    className={cn(
                      'relative max-w-[86%] rounded-2xl px-4 py-3 group',
                      msg.role === 'user'
                        ? 'rounded-tr-md bg-[#C49557] text-[#081422]'
                        : 'rounded-tl-md border border-white/[0.09] bg-white/[0.045] text-[#F7F0E8]',
                    )}
                  >
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                      {msg.loading && (
                        <span className="inline-flex items-center gap-1 ml-2 align-middle">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#C49557] animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#C49557] animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#C49557] animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                      )}
                    </p>
                    {msg.role === 'assistant' && !msg.loading && msg.content && (
                      <button
                        onClick={() => copiar(msg.id, msg.content)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-white/[0.35] hover:text-white hover:bg-white/[0.08]"
                        aria-label="Copiar resposta"
                      >
                        {copiado === msg.id ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="p-5 border-t border-white/[0.08]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                <textarea
                  ref={textareaRef}
                  value={mensagem}
                  onChange={e => setMensagem(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={loading}
                  rows={3}
                  placeholder="Escreva para a Aurora..."
                  className="w-full resize-none bg-transparent outline-none text-[14px] leading-relaxed text-[#F7F0E8] placeholder:text-white/[0.28]"
                  style={{ maxHeight: 180 }}
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-white/[0.28]">
                    Ações sensíveis exigem confirmação expressa de um sócio.
                  </p>
                  <button
                    onClick={() => enviar()}
                    disabled={loading || !mensagem.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#C49557] px-4 py-2 text-[13px] font-semibold text-[#081422] hover:bg-[#D4AA6D] transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    Enviar
                  </button>
                </div>
              </div>
            </div>
          </section>

          <aside className="p-5 bg-black/10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C49557]">
                Sugestões rápidas
              </p>
              <div className="mt-3 space-y-2">
                {SUGESTOES.map(sugestao => (
                  <button
                    key={sugestao}
                    onClick={() => {
                      setMensagem(sugestao)
                      textareaRef.current?.focus()
                    }}
                    className="w-full text-left rounded-xl border border-white/[0.09] bg-white/[0.035] px-3 py-2.5 text-[12px] font-medium text-white/[0.68] hover:border-[#C49557]/45 hover:text-white hover:bg-[#C49557]/10 transition-colors"
                  >
                    {sugestao}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/[0.09] bg-white/[0.035] p-4">
              <p className="text-[12px] font-semibold text-[#F7F0E8]">Limites operacionais</p>
              <p className="mt-2 text-[11px] leading-relaxed text-white/[0.45]">
                A Aurora prepara análises, minutas e planos para revisão. Ela não envia mensagens,
                altera dados, libera documentos, protocola peças ou executa automações sem aprovação expressa.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
