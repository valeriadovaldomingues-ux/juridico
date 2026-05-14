'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Loader2, MessageSquare } from 'lucide-react'

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
  mensagem:               'Mensagem',
  solicitacao_documento:  'Solicitação de documento',
  solicitacao_prazo:      'Solicitação sobre prazo',
  outro:                  'Outro',
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
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-[20px] font-semibold text-[#0f1923]">Mensagens</h1>

      {/* Thread */}
      <div className="bg-white rounded-2xl border border-[#D0DCDC] shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="h-[420px] overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={20} className="animate-spin text-[#D0DCDC]" />
            </div>
          ) : mensagens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <MessageSquare size={28} className="text-[#D0DCDC]" />
              <p className="text-[13px] text-[#9ca3af]">Nenhuma mensagem ainda.</p>
              <p className="text-[12px] text-[#c5cdd8]">Envie uma mensagem para o escritório.</p>
            </div>
          ) : (
            mensagens.map(m => (
              <div
                key={m.id}
                className={`flex ${m.autor_tipo === 'cliente' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    m.autor_tipo === 'cliente'
                      ? 'bg-[#0F3D3E] text-white rounded-br-sm'
                      : 'bg-[#f3f4f6] text-[#374151] rounded-bl-sm'
                  }`}
                >
                  {m.tipo !== 'mensagem' && (
                    <p className={`text-[10px] font-semibold mb-1 ${m.autor_tipo === 'cliente' ? 'text-white/70' : 'text-[#9ca3af]'}`}>
                      {TIPO_LABELS[m.tipo] ?? m.tipo}
                    </p>
                  )}
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.conteudo}</p>
                  <p className={`text-[10px] mt-1.5 ${m.autor_tipo === 'cliente' ? 'text-white/50' : 'text-[#c5cdd8]'}`}>
                    {new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Formulário */}
        <div className="border-t border-[#f3f4f6] p-4 space-y-3">
          {erro && (
            <p className="text-[12px] text-[#e74c3c] bg-[#fde8e8] px-3 py-2 rounded-xl">{erro}</p>
          )}
          <div>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className="w-full text-[12px] px-3 py-2 bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B] text-[#374151]"
            >
              {Object.entries(TIPO_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <form onSubmit={enviar} className="flex gap-2">
            <textarea
              value={conteudo}
              onChange={e => setConteudo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(e as unknown as React.FormEvent) } }}
              placeholder="Escreva sua mensagem… (Enter para enviar)"
              rows={2}
              className="flex-1 text-[13px] px-3 py-2.5 bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B] resize-none text-[#374151] placeholder:text-[#c5cdd8]"
            />
            <button
              type="submit"
              disabled={enviando || !conteudo.trim()}
              className="px-4 py-2.5 bg-[#0F3D3E] hover:bg-[#145A5B] text-white rounded-xl transition-colors disabled:opacity-50 self-end"
            >
              {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
