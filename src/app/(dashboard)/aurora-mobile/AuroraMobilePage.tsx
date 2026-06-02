'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Download,
  Loader2,
  Mic,
  MicOff,
  Plus,
  Paperclip,
  Send,
  Sparkles,
  X,
} from 'lucide-react'
import {
  AURORA_MOBILE_MODULE_LINKS,
  AURORA_MOBILE_QUICK_COMMANDS,
  type AuroraMobileQuickCommand,
} from '@/lib/aurora-mobile'
import {
  CENTRAL_ARQUIVOS_ALLOWED_EXTENSIONS,
  CENTRAL_ARQUIVOS_ALLOWED_MIME_TYPES,
} from '@/lib/central-arquivos/types'
import { cn } from '@/lib/utils'

type MensagemRole = 'user' | 'assistant'

interface Mensagem {
  id: string
  role: MensagemRole
  content: string
  loading?: boolean
}

interface AnexoSelecionado {
  id: string
  file: File
  nome: string
  tipo: string
  tamanho: number
}

type MobileSpeechRecognitionCtor = new () => {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null
  onend: (() => void) | null
  onerror?: (() => void) | null
  start: () => void
  stop: () => void
}

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: MobileSpeechRecognitionCtor
  webkitSpeechRecognition?: MobileSpeechRecognitionCtor
}

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

function mapHistorico(mensagens: Mensagem[]) {
  return mensagens
    .filter(msg => !msg.loading && msg.content.trim())
    .map(msg => ({ role: msg.role, content: msg.content }))
}

const ACCEPTED_FILES = [
  ...CENTRAL_ARQUIVOS_ALLOWED_EXTENSIONS.map(ext => `.${ext}`),
  ...CENTRAL_ARQUIVOS_ALLOWED_MIME_TYPES,
].join(',')
const AURORA_ATTACHMENT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024

function makeAttachmentId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function formatFileSize(bytes: number) {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

function validarAnexo(file: File) {
  const nome = file.name.toLowerCase()
  const extensao = nome.includes('.') ? nome.split('.').pop() ?? '' : ''
  const mime = file.type.toLowerCase()

  if (!CENTRAL_ARQUIVOS_ALLOWED_EXTENSIONS.includes(extensao as typeof CENTRAL_ARQUIVOS_ALLOWED_EXTENSIONS[number])) {
    return 'Tipo de arquivo não permitido.'
  }

  if (!CENTRAL_ARQUIVOS_ALLOWED_MIME_TYPES.includes(mime as typeof CENTRAL_ARQUIVOS_ALLOWED_MIME_TYPES[number])) {
    return 'Tipo de arquivo não permitido.'
  }

  if (file.size <= 0 || file.size > AURORA_ATTACHMENT_MAX_UPLOAD_BYTES) {
    return 'Arquivo excede o tamanho máximo permitido.'
  }

  return null
}

export default function AuroraMobilePage() {
  const [mensagem, setMensagem] = useState('')
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [listening, setListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [showInstallHint, setShowInstallHint] = useState(true)
  const [anexos, setAnexos] = useState<AnexoSelecionado[]>([])
  const [salvarAnexosNoDossie, setSalvarAnexosNoDossie] = useState(false)
  const [erroAnexos, setErroAnexos] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<InstanceType<MobileSpeechRecognitionCtor> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasMessages = mensagens.length > 0
  const canSend = mensagem.trim().length > 0 && !loading

  const placeholder = useMemo(() => (
    loading ? 'A Aurora está respondendo...' : 'Escreva ou dite uma mensagem para a Aurora...'
  ), [loading])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [mensagens])

  useEffect(() => {
    const speechWindow = window as WindowWithSpeechRecognition
    setSpeechSupported(!!(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition))
    return () => recognitionRef.current?.stop()
  }, [])

  async function enviar(texto?: string) {
    const conteudo = (texto ?? mensagem).trim()
    if (!conteudo || loading) return

    const userId = makeMessageId()
    const assistantId = makeMessageId()
    const historico = mapHistorico(mensagens)
    const deveEnviarAnexos = anexos.length > 0

    setErro('')
    setErroAnexos('')
    setMensagem('')
    setLoading(true)
    setMensagens(prev => [
      ...prev,
      { id: userId, role: 'user', content: conteudo },
      { id: assistantId, role: 'assistant', content: '', loading: true },
    ])

    try {
      const res = await fetch('/api/ia/aurora', {
        method: 'POST',
        headers: deveEnviarAnexos ? undefined : { 'Content-Type': 'application/json' },
        body: deveEnviarAnexos
          ? (() => {
              const formData = new FormData()
              formData.append('mensagem', conteudo)
              formData.append('historico', JSON.stringify(historico))
              formData.append('salvarAnexosNoDossie', String(salvarAnexosNoDossie))
              anexos.forEach(anexo => formData.append('anexos', anexo.file))
              return formData
            })()
          : JSON.stringify({ mensagem: conteudo, historico }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(err.error ?? `Erro ${res.status}`)
      }

      const contentType = res.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const data = await res.json()
        const resposta = typeof data.resposta === 'string' ? data.resposta : ''
        if (!resposta) throw new Error(data.error ?? 'Resposta vazia da Aurora')
        setMensagens(prev => prev.map(msg =>
          msg.id === assistantId ? { ...msg, content: resposta, loading: false } : msg
        ))
        limparAnexosSelecionados()
        return
      }

      if (!res.body) throw new Error('Resposta vazia da Aurora')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setMensagens(prev => prev.map(msg =>
          msg.id === assistantId ? { ...msg, content: acc } : msg
        ))
      }

      setMensagens(prev => prev.map(msg =>
        msg.id === assistantId ? { ...msg, loading: false } : msg
      ))
      limparAnexosSelecionados()
    } catch (error) {
      if (IS_DEV) console.error('[Aurora mobile] erro ao enviar', error)
      const detalhe = getErrorMessage(error)
      setErro(IS_DEV ? `Erro ao falar com a Aurora: ${detalhe}` : 'Erro ao falar com a Aurora. Tente novamente.')
      setMensagens(prev => prev.map(msg =>
        msg.id === assistantId
          ? { ...msg, content: 'Não consegui concluir a resposta nesta tentativa.', loading: false }
          : msg
      ))
    } finally {
      setLoading(false)
    }
  }

  function executarComando(command: AuroraMobileQuickCommand) {
    enviar(command.message)
  }

  function toggleSpeech() {
    if (!speechSupported || loading) return
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const speechWindow = window as WindowWithSpeechRecognition
    const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSpeechSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'pt-BR'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onresult = event => {
      const transcript = Array.from(event.results)
        .map(result => result[0]?.transcript ?? '')
        .join(' ')
        .trim()
      if (transcript) {
        setMensagem(prev => prev ? `${prev.trim()} ${transcript}` : transcript)
        textareaRef.current?.focus()
      }
    }
    ;(recognition as InstanceType<MobileSpeechRecognitionCtor>).onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }

  function novoChat() {
    setMensagens([])
    setErro('')
    setMensagem('')
    limparAnexosSelecionados()
    textareaRef.current?.focus()
  }

  function limparAnexosSelecionados() {
    setAnexos([])
    setSalvarAnexosNoDossie(false)
    setErroAnexos('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function anexarArquivos(files: FileList | File[]) {
    setErroAnexos('')
    const selecionados = Array.from(files)
    if (!selecionados.length) return

    const anexosValidos: AnexoSelecionado[] = []
    for (const file of selecionados) {
      const erroFile = validarAnexo(file)
      if (erroFile) {
        setErroAnexos(erroFile)
        return
      }
      anexosValidos.push({
        id: makeAttachmentId(file),
        file,
        nome: file.name,
        tipo: file.type || 'desconhecido',
        tamanho: file.size,
      })
    }

    setAnexos(prev => [...prev, ...anexosValidos])
  }

  return (
    <div className="-m-6 min-h-screen bg-[#07111f] text-[#F7F0E8] sm:m-0 sm:min-h-[calc(100vh-104px)] sm:rounded-3xl sm:border sm:border-[#C49557]/20 sm:shadow-2xl sm:shadow-slate-950/20">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col sm:min-h-[calc(100vh-104px)]">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-[#07111f]/95 px-4 pb-3 pt-4 backdrop-blur sm:rounded-t-3xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#C49557]/15 text-[#D4AA6D]">
                <Sparkles size={20} />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-[20px] font-semibold tracking-tight">Aurora</h1>
                <p className="truncate text-[12px] text-white/45">Chat executivo dos sócios</p>
              </div>
            </div>
            <button
              onClick={novoChat}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white"
              aria-label="Novo chat"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {AURORA_MOBILE_MODULE_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#C49557]/20 bg-[#C49557]/10 px-3 py-1.5 text-[11px] font-semibold text-[#D4AA6D]"
              >
                {link.label}
                <ArrowUpRight size={11} />
              </Link>
            ))}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-4">
          {showInstallHint && (
            <div className="mb-4 rounded-2xl border border-[#C49557]/20 bg-[#C49557]/10 p-3">
              <div className="flex items-start gap-3">
                <Download size={16} className="mt-0.5 shrink-0 text-[#D4AA6D]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-[#F7F0E8]">Adicionar à tela inicial</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/50">
                    No celular, use o menu do navegador e escolha “Adicionar à tela inicial” para abrir como app.
                  </p>
                </div>
                <button
                  onClick={() => setShowInstallHint(false)}
                  className="rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white"
                  aria-label="Ocultar instrução de instalação"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {!hasMessages && (
            <section className="mb-5 rounded-3xl border border-white/10 bg-white/[0.045] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C49557]">
                Pessoa e do Val Advocacia
              </p>
              <h2 className="mt-3 text-[22px] font-semibold leading-tight tracking-tight">
                Converse com a Aurora pelo celular, dentro do sistema.
              </h2>
              <p className="mt-3 text-[13px] leading-relaxed text-white/50">
                Use para organizar prioridades, consultar publicações via Aurora, preparar respostas e revisar demandas. Ações sensíveis continuam exigindo revisão humana.
              </p>
            </section>
          )}

          <div className="space-y-3">
            {mensagens.map(msg => (
              <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="mr-2 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C49557]/15 text-[#D4AA6D]">
                    <Bot size={15} />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[84%] rounded-3xl px-4 py-3 text-[14px] leading-relaxed shadow-sm',
                    msg.role === 'user'
                      ? 'rounded-br-md bg-[#C49557] text-[#07111f]'
                      : 'rounded-bl-md border border-white/10 bg-white/[0.055] text-[#F7F0E8]',
                  )}
                >
                  <p className="whitespace-pre-wrap">
                    {msg.content}
                    {msg.loading && (
                      <span className="ml-2 inline-flex items-center gap-1 align-middle">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D4AA6D]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D4AA6D] [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D4AA6D] [animation-delay:300ms]" />
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div ref={bottomRef} />
        </main>

        <footer className="sticky bottom-0 border-t border-white/10 bg-[#07111f]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:rounded-b-3xl">
          {erro && (
            <div className="mb-3 flex items-start gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-100">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {erro}
            </div>
          )}

          <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {AURORA_MOBILE_QUICK_COMMANDS.map(command => (
              <button
                key={command.label}
                onClick={() => executarComando(command)}
                disabled={loading}
                className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-medium text-white/70 transition-colors hover:border-[#C49557]/40 hover:bg-[#C49557]/10 hover:text-white disabled:opacity-45"
              >
                {command.label}
              </button>
            ))}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-2">
            {anexos.length > 0 && (
              <div className="space-y-2 px-2 pb-2">
                {anexos.map(anexo => (
                  <div
                    key={anexo.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium">{anexo.nome}</p>
                      <p className="text-[11px] text-white/45">
                        {anexo.tipo} • {formatFileSize(anexo.tamanho)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAnexos(prev => prev.filter(item => item.id !== anexo.id))}
                      className="rounded-full p-1.5 text-white/45 hover:bg-white/10 hover:text-white"
                      aria-label={`Remover ${anexo.nome}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {erroAnexos && (
              <p className="px-2 pb-2 text-[12px] font-medium text-rose-300">{erroAnexos}</p>
            )}

            <textarea
              ref={textareaRef}
              value={mensagem}
              onChange={event => setMensagem(event.target.value)}
              disabled={loading}
              rows={3}
              placeholder={placeholder}
              className="max-h-36 w-full resize-none bg-transparent px-2 py-2 text-[16px] leading-relaxed text-[#F7F0E8] outline-none placeholder:text-white/30"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_FILES}
                  multiple
                  className="hidden"
                  onChange={event => {
                    anexarArquivos(event.target.files ?? [])
                    event.currentTarget.value = ''
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Anexar documentos"
                  title="Anexar documentos"
                >
                  <Paperclip size={18} />
                </button>
                <button
                  type="button"
                  onClick={toggleSpeech}
                  disabled={!speechSupported || loading}
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors',
                    listening
                      ? 'border-red-300/30 bg-red-500/20 text-red-100'
                      : 'border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white',
                    (!speechSupported || loading) && 'cursor-not-allowed opacity-40',
                  )}
                  aria-label={listening ? 'Parar ditado' : 'Ditar mensagem'}
                  title={speechSupported ? 'Ditar mensagem' : 'Ditado não suportado neste navegador'}
                >
                  {speechSupported ? (listening ? <MicOff size={18} /> : <Mic size={18} />) : <MicOff size={18} />}
                </button>
              </div>

              <p className="min-w-0 flex-1 truncate px-1 text-[11px] text-white/30">
                {speechSupported ? 'Microfone disponível no navegador' : 'Digite a mensagem; microfone indisponível'}
              </p>

              <button
                type="button"
                onClick={() => enviar()}
                disabled={!canSend}
                className="flex h-11 min-w-24 items-center justify-center gap-2 rounded-2xl bg-[#C49557] px-4 text-[13px] font-bold text-[#07111f] transition-colors hover:bg-[#D4AA6D] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loading ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                Enviar
              </button>
            </div>
            <label className="mt-2 flex items-center gap-2 px-1 text-[11px] font-medium text-white/55">
              <input
                type="checkbox"
                checked={salvarAnexosNoDossie}
                onChange={event => setSalvarAnexosNoDossie(event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-transparent text-[#C49557] focus:ring-[#C49557]"
              />
              Salvar estes anexos no Dossiê Aurora
            </label>
          </div>
        </footer>
      </div>
    </div>
  )
}
