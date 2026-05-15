'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Loader2, MessageSquare, ArrowRight } from 'lucide-react'

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
  solicitacao_documento: 'Solicitação de documento',
  solicitacao_prazo:     'Solicitação sobre prazo',
  outro:                 'Outro',
}

function formatHora(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function PortalMensagensPage() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [conteudo,  setConteudo]  = useState('')
  const [tipo,      setTipo]      = useState('mensagem')
  const [loading,   setLoading]   = useState(true)
  const [enviando,  setEnviando]  = useState(false)
  const [erro,      setErro]      = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/portal/mensagens')
      .then(r => r.json())
      .then(data => { setMensagens(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!conteudo.trim()) return
    setEnviando(true)
    setErro('')

    const res = await fetch('/api/portal/mensagens', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ conteudo: conteudo.trim(), tipo }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setErro(err.error ?? 'Erro ao enviar mensagem')
      setEnviando(false)
      return
    }

    const nova = await res.json()
    setMensagens(prev => [...prev, nova])
    setConteudo('')
    setEnviando(false)
  }

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
      <div className="bg-white border border-[#E8E3D8] overflow-hidden">

        {/* Área de mensagens */}
        <div className="h-[420px] overflow-y-auto p-5 space-y-4 bg-[#FDFAF7]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={18} className="animate-spin text-[#E8E3D8]" />
            </div>
          ) : mensagens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <MessageSquare size={24} className="text-[#E8E3D8]" strokeWidth={1} />
              <p className="text-[13px] text-[#9CA3AF]">Nenhuma mensagem ainda.</p>
              <p className="text-[11px] text-[#C5C0B8]">
                Envie uma mensagem para o escritório abaixo.
              </p>
            </div>
          ) : (
            mensagens.map(m => (
              <div
                key={m.id}
                className={`flex ${m.autor_tipo === 'cliente' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[78%] px-4 py-3 ${
                    m.autor_tipo === 'cliente'
                      ? 'bg-[#0C1B2A] text-white'
                      : 'bg-white border border-[#E8E3D8] text-[#1C1C2E]'
                  }`}
                >
                  {m.tipo !== 'mensagem' && (
                    <p className={`text-[9px] font-medium tracking-[0.1em] uppercase mb-1.5 ${
                      m.autor_tipo === 'cliente' ? 'text-[#C49557]' : 'text-[#C49557]'
                    }`}>
                      {TIPO_LABELS[m.tipo] ?? m.tipo}
                    </p>
                  )}
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.conteudo}</p>
                  <p className={`text-[10px] mt-2 ${
                    m.autor_tipo === 'cliente' ? 'text-white/30' : 'text-[#C5C0B8]'
                  }`}>
                    {formatHora(m.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Formulário */}
        <div className="border-t border-[#E8E3D8] p-4 space-y-3 bg-white">
          {erro && (
            <p className="text-[12px] text-[#e74c3c] bg-[#fde8e8] border border-[#f5c6c6] px-3 py-2">
              {erro}
            </p>
          )}

          <select
            value={tipo}
            onChange={e => setTipo(e.target.value)}
            className="w-full text-[11px] px-3 py-2 bg-[#FDFAF7] border border-[#E8E3D8] outline-none focus:border-[#C49557]/50 text-[#5A5A70] tracking-wide transition-colors"
          >
            {Object.entries(TIPO_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          <form onSubmit={enviar} className="flex gap-2">
            <textarea
              value={conteudo}
              onChange={e => setConteudo(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  enviar(e as unknown as React.FormEvent)
                }
              }}
              placeholder="Escreva sua mensagem… (Enter para enviar)"
              rows={2}
              className="flex-1 text-[13px] px-3 py-2.5 bg-[#FDFAF7] border border-[#E8E3D8] outline-none focus:border-[#C49557]/50 resize-none text-[#1C1C2E] placeholder:text-[#C5C0B8] transition-colors"
            />
            <button
              type="submit"
              disabled={enviando || !conteudo.trim()}
              className="px-4 py-2.5 bg-[#C49557] hover:bg-[#A8803D] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed self-end"
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
