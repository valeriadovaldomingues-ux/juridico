'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Search, ShieldCheck, Unlink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SafeConnection {
  id: string
  google_email: string
  scopes: string[]
  status: 'active' | 'revoked' | 'error'
  token_expires_at: string | null
  updated_at: string
}

interface PreviewMessage {
  id: string
  threadId: string
  from: string
  subject: string
  date: string | null
  snippet: string
  labelIds: string[]
  categoria:
    | 'propaganda_newsletter'
    | 'spam_provavel'
    | 'possivelmente_importante'
    | 'juridico_processual'
    | 'cliente_contato_humano'
    | 'financeiro_banco_pagamento'
    | 'nao_classificado'
  confianca: 'baixa' | 'media' | 'alta'
  preSelecionado: boolean
  alertaAnexo: boolean
  sugestao: 'revisar' | 'manter' | 'candidata_publicacao' | 'candidata_limpeza'
  motivos: string[]
}

interface PreviewResponse {
  query: string
  totalEstimado: number
  mensagens: PreviewMessage[]
  aviso: string
}

const inputCls = 'w-full rounded-xl border border-[#E2DDD8] bg-[#F8F7F5] px-3 py-2 text-[13px] text-[#0f1923] outline-none transition-colors focus:border-[#1D5F60] focus:bg-white'

const SUGESTAO_LABEL: Record<PreviewMessage['sugestao'], string> = {
  revisar: 'Revisar',
  manter: 'Manter',
  candidata_publicacao: 'Possível publicação',
  candidata_limpeza: 'Candidata à limpeza',
}

const CATEGORIA_LABEL: Record<PreviewMessage['categoria'], string> = {
  propaganda_newsletter: 'Provável propaganda/newsletter',
  spam_provavel: 'Spam provável',
  possivelmente_importante: 'E-mail possivelmente importante',
  juridico_processual: 'Jurídico/processual',
  cliente_contato_humano: 'Cliente/contato humano',
  financeiro_banco_pagamento: 'Financeiro/banco/pagamento',
  nao_classificado: 'Não classificado',
}

type PreviewFilter = 'limpeza' | 'todos' | 'importantes' | 'juridicos'

export default function GmailIntegracaoPage() {
  const [connection, setConnection] = useState<SafeConnection | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('limpeza')
  const [hideImportant, setHideImportant] = useState(false)
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    remetente: '',
    assunto: '',
    palavraChave: '',
    posteriorA: '',
    anteriorA: '',
    comAnexos: false,
    maxResults: '10',
  })

  const conectado = !!connection
  const statusText = useMemo(() => {
    if (statusLoading) return 'Verificando conexão...'
    if (!connection) return 'Gmail não conectado'
    return `Conectado como ${connection.google_email}`
  }, [connection, statusLoading])

  const mensagensFiltradas = useMemo(() => {
    const mensagens = preview?.mensagens ?? []
    return mensagens.filter(message => {
      const importante = ['possivelmente_importante', 'cliente_contato_humano', 'financeiro_banco_pagamento'].includes(message.categoria)
      if (hideImportant && importante) return false
      if (previewFilter === 'limpeza') return ['propaganda_newsletter', 'spam_provavel'].includes(message.categoria)
      if (previewFilter === 'importantes') return importante
      if (previewFilter === 'juridicos') return message.categoria === 'juridico_processual'
      return true
    })
  }, [hideImportant, preview?.mensagens, previewFilter])

  async function carregarStatus() {
    setStatusLoading(true)
    setError('')
    try {
      const res = await fetch('/api/integracoes/google/oauth/status')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`)
      setConnection(data.connection)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao verificar conexão Gmail')
    } finally {
      setStatusLoading(false)
    }
  }

  useEffect(() => {
    carregarStatus()
  }, [])

  async function desconectar() {
    if (!confirm('Desconectar o Gmail? A conexão OAuth será revogada no sistema e os e-mails não serão alterados.')) return
    setError('')
    const res = await fetch('/api/integracoes/google/oauth/disconnect', { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Erro ao desconectar Gmail')
      return
    }
    setConnection(null)
    setPreview(null)
  }

  function buscarPreview() {
    startTransition(async () => {
      setError('')
      setPreview(null)
      try {
        const res = await fetch('/api/integracoes/google/gmail/cleanup-preview', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...form,
            maxResults: Number(form.maxResults) || 10,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`)
        setPreview(data)
        setSelectedIds((data.mensagens as PreviewMessage[])
          .filter(message => message.preSelecionado)
          .map(message => message.id))
        setPreviewFilter('limpeza')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao buscar prévia no Gmail')
      }
    })
  }

  function toggleSelecionado(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-[#0f1923]">Integração Gmail</h1>
          <p className="mt-1 text-[13px] text-[#7a8899]">
            Pré-análise de limpeza para sócios, com OAuth Google e escopo somente leitura.
          </p>
        </div>
        <div className={cn(
          'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold',
          conectado ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700',
        )}>
          {conectado ? <CheckCircle2 size={13} /> : <ShieldCheck size={13} />}
          {statusText}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-[#E2DDD8] bg-white shadow-sm">
        <div className="border-b border-[#F0F6F6] px-5 py-4">
          <h2 className="text-[14px] font-bold text-[#0f1923]">Conexão OAuth</h2>
          <p className="mt-0.5 text-[12px] text-[#7a8899]">
            O sistema usa `gmail.readonly`. Tokens ficam criptografados e nunca são enviados ao navegador.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-[13px] font-semibold text-[#0f1923]">{statusText}</p>
            <p className="mt-1 text-[12px] text-[#7a8899]">
              Nenhum e-mail será apagado, arquivado, movido, marcado como spam ou enviado nesta fase.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!conectado && (
              <a
                href="/api/integracoes/google/oauth/start"
                className="inline-flex items-center gap-2 rounded-xl bg-[#1D5F60] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#27777A]"
              >
                <ExternalLink size={13} /> Conectar Gmail
              </a>
            )}
            {conectado && (
              <button
                onClick={desconectar}
                className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-[13px] font-semibold text-red-700 transition-colors hover:bg-red-100"
              >
                <Unlink size={13} /> Desconectar
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[#E2DDD8] bg-white shadow-sm">
        <div className="border-b border-[#F0F6F6] px-5 py-4">
          <h2 className="text-[14px] font-bold text-[#0f1923]">Busca de candidatos à limpeza</h2>
          <p className="mt-0.5 text-[12px] text-[#7a8899]">
            Retorna remetente, assunto, data, snippet, labels, categoria, confiança e motivo sugerido. Limite máximo: 20 mensagens.
          </p>
        </div>

        <div className="grid gap-3 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1.5 text-[12px] font-semibold text-[#4a5a6a]">
            Remetente
            <input className={inputCls} value={form.remetente} onChange={e => setForm(f => ({ ...f, remetente: e.target.value }))} placeholder="ex: newsletter@dominio.com" />
          </label>
          <label className="space-y-1.5 text-[12px] font-semibold text-[#4a5a6a]">
            Assunto
            <input className={inputCls} value={form.assunto} onChange={e => setForm(f => ({ ...f, assunto: e.target.value }))} placeholder="ex: intimação, oferta, relatório" />
          </label>
          <label className="space-y-1.5 text-[12px] font-semibold text-[#4a5a6a]">
            Palavra-chave
            <input className={inputCls} value={form.palavraChave} onChange={e => setForm(f => ({ ...f, palavraChave: e.target.value }))} placeholder="termo livre" />
          </label>
          <label className="space-y-1.5 text-[12px] font-semibold text-[#4a5a6a]">
            Depois de
            <input type="date" className={inputCls} value={form.posteriorA} onChange={e => setForm(f => ({ ...f, posteriorA: e.target.value }))} />
          </label>
          <label className="space-y-1.5 text-[12px] font-semibold text-[#4a5a6a]">
            Antes de
            <input type="date" className={inputCls} value={form.anteriorA} onChange={e => setForm(f => ({ ...f, anteriorA: e.target.value }))} />
          </label>
          <label className="space-y-1.5 text-[12px] font-semibold text-[#4a5a6a]">
            Limite
            <input type="number" min={1} max={20} className={inputCls} value={form.maxResults} onChange={e => setForm(f => ({ ...f, maxResults: e.target.value }))} />
          </label>
          <label className="flex items-center gap-2 text-[12px] font-semibold text-[#4a5a6a]">
            <input type="checkbox" checked={form.comAnexos} onChange={e => setForm(f => ({ ...f, comAnexos: e.target.checked }))} />
            Apenas e-mails com anexos
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#F0F6F6] px-5 py-4">
          <p className="text-[12px] text-[#9aabb8]">
            A prévia não baixa anexos nem lê corpo integral. O snippet é truncado.
          </p>
          <button
            onClick={buscarPreview}
            disabled={!conectado || pending}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f1923] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1f2d3b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            Buscar prévia
          </button>
        </div>
      </section>

      {preview && (
        <section className="rounded-lg border border-[#E2DDD8] bg-white shadow-sm">
          <div className="border-b border-[#F0F6F6] px-5 py-4">
            <h2 className="text-[14px] font-bold text-[#0f1923]">Prévia de candidatos</h2>
            <p className="mt-0.5 text-[12px] text-[#7a8899]">
              Query: <span className="font-mono">{preview.query}</span> · estimativa: {preview.totalEstimado}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0F6F6] px-5 py-3">
            <div className="flex flex-wrap gap-2">
              {([
                ['limpeza', 'Mostrar apenas propaganda/spam provável'],
                ['todos', 'Mostrar todos'],
                ['importantes', 'Mostrar possíveis importantes'],
                ['juridicos', 'Mostrar jurídicos/processuais'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setPreviewFilter(value)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors',
                    previewFilter === value
                      ? 'border-[#1D5F60] bg-[#F0F6F6] text-[#0F3D3E]'
                      : 'border-[#E2DDD8] text-[#7a8899] hover:bg-[#F8F7F5]',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[11px] font-semibold text-[#7a8899]">
              <input
                type="checkbox"
                checked={hideImportant}
                onChange={event => setHideImportant(event.target.checked)}
              />
              Ocultar e-mails possivelmente importantes
            </label>
          </div>
          <div className="divide-y divide-[#F0F6F6]">
            {mensagensFiltradas.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px] text-[#7a8899]">
                Nenhuma mensagem encontrada para os filtros informados.
              </div>
            ) : mensagensFiltradas.map(message => (
              <article key={message.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(message.id)}
                      onChange={() => toggleSelecionado(message.id)}
                      className="mt-1"
                      aria-label={`Selecionar ${message.subject}`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-[#0f1923]">{message.subject}</p>
                      <p className="mt-0.5 truncate text-[12px] text-[#7a8899]">{message.from}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-full bg-[#F3F1EE] px-2.5 py-1 text-[11px] font-semibold text-[#4a5a6a]">
                      {CATEGORIA_LABEL[message.categoria]}
                    </span>
                    <span className={cn(
                      'rounded-full px-2.5 py-1 text-[10px] font-semibold',
                      message.confianca === 'alta' && 'bg-emerald-50 text-emerald-700',
                      message.confianca === 'media' && 'bg-amber-50 text-amber-700',
                      message.confianca === 'baixa' && 'bg-slate-100 text-slate-600',
                    )}>
                      Confiança {message.confianca}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-[#4a5a6a]">{message.snippet || '(sem snippet)'}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#9aabb8]">
                  <span>{message.date ?? 'sem data'}</span>
                  <span className="rounded-full bg-[#F3F1EE] px-2 py-0.5 text-[#4a5a6a]">
                    {SUGESTAO_LABEL[message.sugestao]}
                  </span>
                  {message.preSelecionado && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                      pré-selecionado por alta confiança
                    </span>
                  )}
                  {message.alertaAnexo && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-red-700">
                      <AlertTriangle size={10} /> revisar com cuidado: possui anexo
                    </span>
                  )}
                  {message.labelIds.map(label => (
                    <span key={label} className="rounded-full bg-[#F8F7F5] px-2 py-0.5">{label}</span>
                  ))}
                  {message.motivos.map(motivo => (
                    <span key={motivo} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                      <AlertTriangle size={10} /> {motivo}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <div className="border-t border-[#F0F6F6] px-5 py-3 text-[12px] text-[#7a8899]">
            {preview.aviso}
          </div>
        </section>
      )}
    </div>
  )
}
