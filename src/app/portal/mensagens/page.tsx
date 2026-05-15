'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Loader2, ArrowRight } from 'lucide-react'
import ChatSkeleton from '../_components/ChatSkeleton'
import EmptyState   from '../_components/EmptyState'
import { MessageSquare } from 'lucide-react'

interface Mensagem {
  id:          string
  autor_tipo:  'cliente' | 'escritorio'
  conteudo:    string
  tipo:        string
  status:      string
  lida:        boolean
  processo_id: string | null
  created_at:  string
}

const TIPO_LABELS: Record<string, string> = {
  mensagem:              'Mensagem',
  solicitacao_documento: 'Solicitar documento',
  solicitacao_prazo:     'Dúvida sobre prazo',
  outro:                 'Outro assunto',
}

function formatHora(iso: string) {
  const d = new Date(iso)
  const hoje = new Date()
  const ontem = new Date(hoje)
  ontem.setDate(ontem.getDate() - 1)

  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  if (d.toDateString() === hoje.toDateString()) return hora
  if (d.toDateString() === ontem.toDateString()) return `Ontem ${hora}`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ' ' + hora
}

const MAX_CHARS = 4000

export default function PortalMensagensPage() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [conteudo,  setConteudo]  = useState('')
  const [tipo,      setTipo]      = useState('mensagem')
  const [loading,   setLoading]   = useState(true)
  const [enviando,  setEnviando]  = useState(false)
  const [erro,      setErro]      = useState('')
  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const carregar = useCallback(() => {
    fetch('/api/portal/mensagens')
      .then(r => r.json())
      .then(data => { setMensagens(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [conteudo])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    const texto = conteudo.trim()
    if (!texto || enviando) return
    setEnviando(true)
    setErro('')

    const res = await fetch('/api/portal/mensagens', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ conteudo: texto, tipo }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setErro(err.error ?? 'Erro ao enviar mensagem.')
      setEnviando(false)
      return
    }

    const nova = await res.json()
    setMensagens(prev => [...prev, nova])
    setConteudo('')
    setTipo('mensagem')
    setEnviando(false)
    textareaRef.current?.focus()
  }

  const restantes = MAX_CHARS - conteudo.length
  const quaseCheia = restantes < 200

  return (
    <div className="space-y-6 max-w-2xl">

      <div>
        <p className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-1">Portal</p>
        <h1
          className="text-[28px] text-[#1C1C2E] leading-none tracking-tight"
          style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}
        >
          Mensagens
        </h1>
      </div>

      {/* Thread */}
      <div className="bg-white border border-[#E8E3D8] overflow-hidden flex flex-col">

        {/* Barra superior do chat */}
        <div className="px-5 py-3 border-b border-[#F0EBE4] bg-[#FDFAF7] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-[10px] text-[#6B7280] tracking-wide uppercase font-medium">
              Pessoa e do Val
            </span>
          </div>
          {mensagens.length > 0 && (
            <span className="text-[10px] text-[#C5C0B8]">
              {mensagens.length} mensagem{mensagens.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Área de mensagens */}
        <div className="h-[380px] overflow-y-auto portal-scroll bg-[#FDFAF7]">
          {loading ? (
            <ChatSkeleton />
          ) : mensagens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-8 py-10">
              <div className="w-10 h-10 border border-[#E8E3D8] flex items-center justify-center">
                <MessageSquare size={16} className="text-[#C5C0B8]" strokeWidth={1} />
              </div>
              <p className="text-[13px] text-[#6B7280] font-medium">Nenhuma mensagem</p>
              <p className="text-[11px] text-[#9CA3AF] text-center leading-relaxed max-w-[200px]">
                Envie uma mensagem ou dúvida para o escritório.
              </p>
            </div>
          ) : (
            <div className="p-5 space-y-3">
              {mensagens.map((m, i) => {
                const isCliente = m.autor_tipo === 'cliente'
                // Mostrar data separadora quando muda o dia
                const anterior = i > 0 ? mensagens[i - 1] : null
                const mesmaData = anterior &&
                  new Date(anterior.created_at).toDateString() === new Date(m.created_at).toDateString()

                return (
                  <div key={m.id}>
                    {/* Separador de data */}
                    {!mesmaData && i > 0 && (
                      <div className="flex items-center gap-3 py-2 my-1">
                        <div className="flex-1 h-px bg-[#F0EBE4]" />
                        <span className="text-[9px] text-[#C5C0B8] tracking-wide uppercase">
                          {new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                        </span>
                        <div className="flex-1 h-px bg-[#F0EBE4]" />
                      </div>
                    )}

                    <div className={`flex ${isCliente ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[78%] px-4 py-3 transition-opacity duration-150 ${
                          isCliente
                            ? 'bg-[#0C1B2A] text-white'
                            : 'bg-white border border-[#E8E3D8] text-[#1C1C2E]'
                        }`}
                      >
                        {/* Tipo (se não for mensagem comum) */}
                        {m.tipo !== 'mensagem' && (
                          <p className="text-[9px] font-medium tracking-[0.1em] uppercase mb-1.5 text-[#C49557]">
                            {TIPO_LABELS[m.tipo] ?? m.tipo}
                          </p>
                        )}

                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.conteudo}</p>

                        {/* Timestamp + lida */}
                        <div className={`flex items-center gap-1.5 mt-1.5 ${isCliente ? 'justify-end' : 'justify-start'}`}>
                          <p className={`text-[10px] ${isCliente ? 'text-white/30' : 'text-[#C5C0B8]'}`}>
                            {formatHora(m.created_at)}
                          </p>
                          {isCliente && m.lida && (
                            <span className="text-[9px] text-[#C49557]/50">✓✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Área de composição */}
        <div className="border-t border-[#E8E3D8] bg-white">

          {/* Tipo de mensagem */}
          <div className="px-4 pt-3 pb-0">
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className="portal-focus text-[10px] px-2 py-1.5 bg-[#FDFAF7] border border-[#E8E3D8] outline-none text-[#6B7280] tracking-wide transition-colors duration-200 hover:border-[#C49557]/40 focus:border-[#C49557]/50"
            >
              {Object.entries(TIPO_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {/* Erro */}
          {erro && (
            <p className="mx-4 mt-2 text-[11px] text-[#e74c3c] bg-[#fde8e8] border border-[#f5c6c6] px-3 py-1.5">
              {erro}
            </p>
          )}

          {/* Input + envio */}
          <form onSubmit={enviar} className="flex items-end gap-2 p-4 pt-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={conteudo}
                onChange={e => setConteudo(e.target.value.slice(0, MAX_CHARS))}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(e as unknown as React.FormEvent) }
                }}
                placeholder="Escreva sua mensagem… (Enter para enviar, Shift+Enter para nova linha)"
                rows={1}
                className="portal-focus w-full text-[13px] px-3 py-2.5 bg-[#FDFAF7] border border-[#E8E3D8] outline-none resize-none text-[#1C1C2E] placeholder:text-[#C5C0B8] transition-colors duration-200 focus:border-[#C49557]/50 focus:bg-white overflow-hidden"
                style={{ minHeight: '40px', maxHeight: '120px' }}
              />
              {/* Contador de caracteres */}
              {quaseCheia && (
                <span className={`absolute right-2 bottom-1.5 text-[9px] ${restantes < 50 ? 'text-[#e74c3c]' : 'text-[#C5C0B8]'}`}>
                  {restantes}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={enviando || !conteudo.trim()}
              className="w-10 h-10 bg-[#C49557] hover:bg-[#A8803D] text-white flex items-center justify-center transition-colors duration-200 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            >
              {enviando
                ? <Loader2 size={14} className="animate-spin" />
                : <ArrowRight size={14} />
              }
            </button>
          </form>
        </div>
      </div>

    </div>
  )
}
