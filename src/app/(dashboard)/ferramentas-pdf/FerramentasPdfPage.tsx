'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ElementType, FormEvent, ReactNode } from 'react'
import {
  ArrowDownUp,
  FileDown,
  Image as ImageIcon,
  Loader2,
  Merge,
  RotateCcw,
  Scissors,
  Split,
  Wand2,
} from 'lucide-react'

type ToolId = 'merge' | 'image-to-pdf' | 'split' | 'remove-pages' | 'rotate' | 'reorder' | 'compress'

type ResultState = {
  loading: boolean
  error: string | null
  downloadUrl: string | null
  filename: string | null
  notice: string | null
}

const TOOL_TABS: Array<{
  id: ToolId
  label: string
  description: string
  icon: ElementType
  available: boolean
}> = [
  { id: 'merge', label: 'Juntar PDF', description: 'Combine vários PDFs em um único arquivo.', icon: Merge, available: true },
  { id: 'split', label: 'Separar PDF', description: 'Extraia um intervalo de páginas para um novo arquivo.', icon: Split, available: true },
  { id: 'remove-pages', label: 'Remover páginas', description: 'Apague páginas específicas e baixe o arquivo limpo.', icon: Scissors, available: true },
  { id: 'rotate', label: 'Girar PDF', description: 'Gire todas as páginas em 90, 180 ou 270 graus.', icon: RotateCcw, available: true },
  { id: 'reorder', label: 'Reorganizar páginas', description: 'Reordene as páginas sem salvar nada no sistema.', icon: ArrowDownUp, available: true },
  { id: 'image-to-pdf', label: 'Imagem para PDF', description: 'Converta JPG, JPEG ou PNG em um PDF.', icon: ImageIcon, available: true },
  { id: 'compress', label: 'Comprimir PDF', description: 'Reduza o tamanho do arquivo quando tecnicamente possível.', icon: FileDown, available: true },
]

const INITIAL_RESULT: ResultState = {
  loading: false,
  error: null,
  downloadUrl: null,
  filename: null,
  notice: null,
}

function ToolCard({
  title,
  description,
  icon: Icon,
  available = true,
  busy,
  error,
  downloadUrl,
  filename,
  notice,
  onSubmit,
  onClear,
  children,
}: {
  title: string
  description: string
  icon: ElementType
  available?: boolean
  busy: boolean
  error: string | null
  downloadUrl: string | null
  filename: string | null
  notice?: string | null
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onClear: () => void
  children: ReactNode
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-[0_12px_36px_rgba(13,34,53,0.05)]">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-sidebar)] text-white shadow-sm">
            <Icon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-semibold text-[var(--color-ink)] tracking-tight">{title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-ink-3)]">{description}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {children}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        )}

        {downloadUrl && filename && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div>
              <p className="text-[13px] font-semibold text-emerald-900">Arquivo pronto para download</p>
              <p className="text-[12px] text-emerald-800/80">{filename}</p>
            </div>
            <a
              href={downloadUrl}
              download={filename}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-emerald-800"
            >
              <FileDown size={14} />
              Baixar resultado
            </a>
          </div>
        )}

        {notice && (
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-900">
            {notice}
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="submit"
            disabled={busy || !available}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-sidebar)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[var(--color-petrol)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            {busy ? 'Processando...' : 'Processar'}
          </button>
          {downloadUrl && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-[13px] font-medium text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-copper)] hover:text-[var(--color-ink)]"
            >
              Limpar resultado
            </button>
          )}
        </div>
      </div>
    </form>
  )
}

function useDownloadResult() {
  const [state, setState] = useState<ResultState>(INITIAL_RESULT)

  useEffect(() => () => {
    if (state.downloadUrl) URL.revokeObjectURL(state.downloadUrl)
  }, [state.downloadUrl])

  function clear() {
    setState(prev => {
      if (prev.downloadUrl) URL.revokeObjectURL(prev.downloadUrl)
      return INITIAL_RESULT
    })
  }

  async function handleResponse(response: Response, fallbackName: string) {
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Não foi possível processar o PDF.')
    }

    const blob = await response.blob()
    const contentDisposition = response.headers.get('content-disposition') ?? ''
    const match = contentDisposition.match(/filename="([^"]+)"/i)
    const filename = match?.[1] ?? fallbackName
    const downloadUrl = URL.createObjectURL(blob)
    const notice = response.headers.get('x-ferramentas-pdf-notice')

    setState({
      loading: false,
      error: null,
      downloadUrl,
      filename,
      notice,
    })
  }

  function setLoading() {
    setState(prev => ({ ...prev, loading: true, error: null, notice: null }))
  }

  function setError(message: string) {
    setState(prev => ({
      ...prev,
      loading: false,
      error: message,
    }))
  }

  return { state, setState, setLoading, setError, handleResponse, clear }
}

function PDFUploadLabel({ children }: { children: ReactNode }) {
  return <label className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-3)]">{children}</label>
}

function MergeTool() {
  const { state, setLoading, setError, handleResponse, clear } = useDownloadResult()
  const [files, setFiles] = useState<File[]>([])

  return (
    <ToolCard
      title="Juntar PDF"
      description="Envie vários PDFs e receba um único arquivo consolidado. Os arquivos são processados apenas em memória e nada fica salvo no sistema."
      icon={Merge}
      busy={state.loading}
      error={state.error}
      downloadUrl={state.downloadUrl}
      filename={state.filename}
      onClear={clear}
      onSubmit={async (event) => {
        event.preventDefault()
        setLoading()
        try {
          const form = new FormData()
          files.forEach(file => form.append('files', file))
          const response = await fetch('/api/ferramentas-pdf/merge', { method: 'POST', body: form })
          await handleResponse(response, 'pdf-juntado.pdf')
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Erro ao juntar PDFs.')
        }
      }}
    >
      <div className="grid gap-2">
        <PDFUploadLabel>Arquivos PDF</PDFUploadLabel>
        <input
          type="file"
          accept=".pdf,application/pdf"
          multiple
          onChange={event => setFiles(Array.from(event.target.files ?? []))}
          className="block w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-ink-2)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--color-sidebar)] file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-white hover:border-[var(--color-copper)]"
        />
        <p className="text-[12px] text-[var(--color-ink-3)]">
          {files.length > 0 ? `${files.length} arquivo(s) selecionado(s).` : 'Selecione de 1 a 20 PDFs.'}
        </p>
      </div>
    </ToolCard>
  )
}

function ImageToPdfTool() {
  const { state, setLoading, setError, handleResponse, clear } = useDownloadResult()
  const [files, setFiles] = useState<File[]>([])

  return (
    <ToolCard
      title="Imagem para PDF"
      description="Converta JPG, JPEG ou PNG em um único PDF. Cada imagem vira uma página e nada é salvo no sistema."
      icon={ImageIcon}
      busy={state.loading}
      error={state.error}
      downloadUrl={state.downloadUrl}
      filename={state.filename}
      notice={state.notice}
      onClear={clear}
      onSubmit={async (event) => {
        event.preventDefault()
        setLoading()
        try {
          const form = new FormData()
          files.forEach(file => form.append('files', file))
          const response = await fetch('/api/ferramentas-pdf/image-to-pdf', { method: 'POST', body: form })
          await handleResponse(response, 'imagens-convertidas.pdf')
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Erro ao converter imagens para PDF.')
        }
      }}
    >
      <div className="grid gap-2">
        <PDFUploadLabel>Imagens</PDFUploadLabel>
        <input
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          multiple
          onChange={event => setFiles(Array.from(event.target.files ?? []))}
          className="block w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-ink-2)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--color-sidebar)] file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-white hover:border-[var(--color-copper)]"
        />
        <p className="text-[12px] text-[var(--color-ink-3)]">
          {files.length > 0 ? `${files.length} arquivo(s) selecionado(s).` : 'Selecione de 1 a 20 imagens JPG, JPEG ou PNG.'}
        </p>
      </div>
    </ToolCard>
  )
}

function SplitTool() {
  const { state, setLoading, setError, handleResponse, clear } = useDownloadResult()
  const [file, setFile] = useState<File | null>(null)
  const [intervalo, setIntervalo] = useState('1-3')

  return (
    <ToolCard
      title="Separar PDF"
      description="Recorte um intervalo de páginas e baixe apenas esse trecho."
      icon={Split}
      busy={state.loading}
      error={state.error}
      downloadUrl={state.downloadUrl}
      filename={state.filename}
      onClear={clear}
      onSubmit={async (event) => {
        event.preventDefault()
        setLoading()
        try {
          const form = new FormData()
          if (file) form.append('file', file)
          form.append('intervalo', intervalo)
          const response = await fetch('/api/ferramentas-pdf/split', { method: 'POST', body: form })
          await handleResponse(response, 'pdf-separado.pdf')
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Erro ao separar PDF.')
        }
      }}
    >
      <div className="grid gap-2">
        <PDFUploadLabel>Arquivo PDF</PDFUploadLabel>
        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={event => setFile(event.target.files?.[0] ?? null)}
          className="block w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-ink-2)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--color-sidebar)] file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-white hover:border-[var(--color-copper)]"
        />
      </div>
      <div className="grid gap-2">
        <PDFUploadLabel>Intervalo de páginas</PDFUploadLabel>
        <input
          type="text"
          value={intervalo}
          onChange={event => setIntervalo(event.target.value)}
          placeholder="1-3"
          className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-copper)]"
        />
      </div>
    </ToolCard>
  )
}

function RemovePagesTool() {
  const { state, setLoading, setError, handleResponse, clear } = useDownloadResult()
  const [file, setFile] = useState<File | null>(null)
  const [paginas, setPaginas] = useState('1,3,5')

  return (
    <ToolCard
      title="Remover páginas"
      description="Envie um PDF e informe as páginas que quer excluir."
      icon={Scissors}
      busy={state.loading}
      error={state.error}
      downloadUrl={state.downloadUrl}
      filename={state.filename}
      onClear={clear}
      onSubmit={async (event) => {
        event.preventDefault()
        setLoading()
        try {
          const form = new FormData()
          if (file) form.append('file', file)
          form.append('paginas', paginas)
          const response = await fetch('/api/ferramentas-pdf/remove-pages', { method: 'POST', body: form })
          await handleResponse(response, 'pdf-sem-paginas.pdf')
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Erro ao remover páginas.')
        }
      }}
    >
      <div className="grid gap-2">
        <PDFUploadLabel>Arquivo PDF</PDFUploadLabel>
        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={event => setFile(event.target.files?.[0] ?? null)}
          className="block w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-ink-2)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--color-sidebar)] file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-white hover:border-[var(--color-copper)]"
        />
      </div>
      <div className="grid gap-2">
        <PDFUploadLabel>Páginas a remover</PDFUploadLabel>
        <input
          type="text"
          value={paginas}
          onChange={event => setPaginas(event.target.value)}
          placeholder="1,3,5 ou 2-4"
          className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-copper)]"
        />
      </div>
    </ToolCard>
  )
}

function RotateTool() {
  const { state, setLoading, setError, handleResponse, clear } = useDownloadResult()
  const [file, setFile] = useState<File | null>(null)
  const [rotacao, setRotacao] = useState<'90' | '180' | '270'>('90')

  return (
    <ToolCard
      title="Girar PDF"
      description="Gire todas as páginas do PDF de uma vez."
      icon={RotateCcw}
      busy={state.loading}
      error={state.error}
      downloadUrl={state.downloadUrl}
      filename={state.filename}
      onClear={clear}
      onSubmit={async (event) => {
        event.preventDefault()
        setLoading()
        try {
          const form = new FormData()
          if (file) form.append('file', file)
          form.append('rotacao', rotacao)
          const response = await fetch('/api/ferramentas-pdf/rotate', { method: 'POST', body: form })
          await handleResponse(response, 'pdf-rotacionado.pdf')
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Erro ao girar PDF.')
        }
      }}
    >
      <div className="grid gap-2">
        <PDFUploadLabel>Arquivo PDF</PDFUploadLabel>
        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={event => setFile(event.target.files?.[0] ?? null)}
          className="block w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-ink-2)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--color-sidebar)] file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-white hover:border-[var(--color-copper)]"
        />
      </div>
      <div className="grid gap-2">
        <PDFUploadLabel>Rotação</PDFUploadLabel>
        <select
          value={rotacao}
          onChange={event => setRotacao(event.target.value as '90' | '180' | '270')}
          className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-copper)]"
        >
          <option value="90">90 graus</option>
          <option value="180">180 graus</option>
          <option value="270">270 graus</option>
        </select>
      </div>
    </ToolCard>
  )
}

function ReorderTool() {
  const { state, setLoading, setError, handleResponse, clear } = useDownloadResult()
  const [file, setFile] = useState<File | null>(null)
  const [ordem, setOrdem] = useState('3,1,2,4')

  return (
    <ToolCard
      title="Reorganizar páginas"
      description="Informe a nova ordem das páginas para gerar um PDF reorganizado."
      icon={ArrowDownUp}
      busy={state.loading}
      error={state.error}
      downloadUrl={state.downloadUrl}
      filename={state.filename}
      onClear={clear}
      onSubmit={async (event) => {
        event.preventDefault()
        setLoading()
        try {
          const form = new FormData()
          if (file) form.append('file', file)
          form.append('ordem', ordem)
          const response = await fetch('/api/ferramentas-pdf/reorder', { method: 'POST', body: form })
          await handleResponse(response, 'pdf-reorganizado.pdf')
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Erro ao reorganizar PDF.')
        }
      }}
    >
      <div className="grid gap-2">
        <PDFUploadLabel>Arquivo PDF</PDFUploadLabel>
        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={event => setFile(event.target.files?.[0] ?? null)}
          className="block w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-ink-2)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--color-sidebar)] file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-white hover:border-[var(--color-copper)]"
        />
      </div>
      <div className="grid gap-2">
        <PDFUploadLabel>Nova ordem</PDFUploadLabel>
        <input
          type="text"
          value={ordem}
          onChange={event => setOrdem(event.target.value)}
          placeholder="3,1,2,4"
          className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-copper)]"
        />
      </div>
    </ToolCard>
  )
}

function CompressTool() {
  const { state, setLoading, setError, handleResponse, clear } = useDownloadResult()
  const [file, setFile] = useState<File | null>(null)

  return (
    <ToolCard
      title="Comprimir PDF"
      description="Reduza o tamanho do arquivo quando tecnicamente possível, com compressão básica local e sem envio para terceiros."
      icon={FileDown}
      busy={state.loading}
      error={state.error}
      downloadUrl={state.downloadUrl}
      filename={state.filename}
      notice={state.notice}
      onClear={clear}
      onSubmit={async (event) => {
        event.preventDefault()
        setLoading()
        try {
          const form = new FormData()
          if (file) form.append('file', file)
          const response = await fetch('/api/ferramentas-pdf/compress', { method: 'POST', body: form })
          await handleResponse(response, 'pdf-comprimido.pdf')
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Erro ao comprimir PDF.')
        }
      }}
    >
      <div className="grid gap-2">
        <PDFUploadLabel>Arquivo PDF</PDFUploadLabel>
        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={event => setFile(event.target.files?.[0] ?? null)}
          className="block w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-ink-2)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--color-sidebar)] file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-white hover:border-[var(--color-copper)]"
        />
      </div>
    </ToolCard>
  )
}

export default function FerramentasPdfPage() {
  const [active, setActive] = useState<ToolId>('merge')

  const activeTool = useMemo(() => TOOL_TABS.find(tool => tool.id === active) ?? TOOL_TABS[0], [active])

  return (
    <div className="internal-page max-w-7xl space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 sm:px-7 sm:py-6 shadow-[0_18px_48px_rgba(13,34,53,0.06)]">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[var(--color-petrol-light)] to-transparent pointer-events-none" />
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-copper)] mb-2">
            Ferramentas internas
          </p>
          <h1 className="font-brand text-[34px] font-semibold text-[var(--color-ink)] tracking-tight leading-none">
            Ferramentas PDF
          </h1>
          <p className="text-[13px] text-[var(--color-ink-3)] mt-2 max-w-3xl">
            Operações locais para juntar, converter imagens, dividir, remover, girar, reorganizar e comprimir PDFs. Os arquivos entram por requisição, são processados no servidor e retornam somente para download.
          </p>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-[0_12px_36px_rgba(13,34,53,0.05)]">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-[var(--color-surface-warm)] px-4 py-3 text-[13px] text-[var(--color-ink-2)]">
            <strong className="block text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink)]">Sem IA</strong>
            Esta ferramenta não usa tokens, modelos ou subagentes.
          </div>
          <div className="rounded-xl bg-[var(--color-surface-warm)] px-4 py-3 text-[13px] text-[var(--color-ink-2)]">
            <strong className="block text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink)]">Sem persistência</strong>
            Nenhum arquivo é salvo no sistema após o processamento.
          </div>
          <div className="rounded-xl bg-[var(--color-surface-warm)] px-4 py-3 text-[13px] text-[var(--color-ink-2)]">
            <strong className="block text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink)]">Sem terceiros</strong>
            Não há envio de arquivos para serviços externos.
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-white shadow-[0_12px_36px_rgba(13,34,53,0.05)] overflow-hidden">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-warm)]/40 p-2">
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {TOOL_TABS.map(tool => {
              const Icon = tool.icon
              const selected = active === tool.id
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setActive(tool.id)}
                  className={[
                    'rounded-xl border px-3 py-3 text-left transition-colors',
                    selected
                      ? 'border-[var(--color-copper)] bg-white shadow-sm'
                      : 'border-transparent bg-transparent hover:border-[var(--color-border)] hover:bg-white',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-sidebar)] text-white">
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--color-ink)]">{tool.label}</p>
                      {!tool.available && <p className="text-[11px] text-[var(--color-ink-3)]">Em breve</p>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="text-[18px] font-semibold text-[var(--color-ink)] tracking-tight">{activeTool.label}</h2>
            <p className="mt-1 text-[13px] text-[var(--color-ink-3)]">{activeTool.description}</p>
          </div>

          {active === 'merge' && <MergeTool />}
          {active === 'image-to-pdf' && <ImageToPdfTool />}
          {active === 'split' && <SplitTool />}
          {active === 'remove-pages' && <RemovePagesTool />}
          {active === 'rotate' && <RotateTool />}
          {active === 'reorder' && <ReorderTool />}
          {active === 'compress' && <CompressTool />}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[13px] text-[var(--color-ink-2)] shadow-[0_12px_36px_rgba(13,34,53,0.05)]">
        <p>
          <strong className="text-[var(--color-ink)]">Observação:</strong> os PDFs são processados apenas durante a requisição. Nenhum arquivo é persistido, enviado para terceiros ou indexado no sistema.
        </p>
      </div>
    </div>
  )
}
