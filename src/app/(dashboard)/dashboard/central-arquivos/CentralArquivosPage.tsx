'use client'

import { useMemo, useState } from 'react'
import {
  Download,
  FolderArchive,
  Link2,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react'
import SearchableCombobox, { type SearchableComboboxOption } from '@/components/ui/SearchableCombobox'
import { fetchClienteOptions, fetchProcessoOptions } from '@/lib/search/remote'
import {
  canAnalyzeWithAurora,
  type CentralArquivosDocumento,
  type CentralArquivosPasta,
} from '@/lib/central-arquivos'
import type { UserRole } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  role: UserRole
  initialPastas: CentralArquivosPasta[]
  initialDocumentos: CentralArquivosDocumento[]
  initialError?: string | null
}

const TIPOS_FILTRO = [
  { value: '', label: 'Todos' },
  { value: 'pdf', label: 'PDF' },
  { value: 'documento', label: 'Documentos' },
  { value: 'imagem', label: 'Imagens' },
  { value: 'audio', label: 'Áudios' },
  { value: 'planilha', label: 'Planilhas' },
]

function makeFolderOption(pasta: CentralArquivosPasta): SearchableComboboxOption {
  return {
    value: pasta.id,
    label: pasta.nome,
    description: [
      pasta.cliente?.nome ? `Cliente: ${pasta.cliente.nome}` : null,
      pasta.processo?.numero_processo ? `Processo: ${pasta.processo.numero_processo}` : null,
    ].filter(Boolean).join(' · ') || null,
    keywords: [pasta.nome, pasta.descricao, pasta.cliente?.nome, pasta.processo?.numero_processo]
      .filter(Boolean) as string[],
  }
}

function makeDocumentoResumo(doc: CentralArquivosDocumento) {
  return [
    doc.cliente?.nome ? `Cliente: ${doc.cliente.nome}` : null,
    doc.processo?.numero_processo ? `Processo: ${doc.processo.numero_processo}` : null,
    doc.categoria ? `Categoria: ${doc.categoria}` : null,
    doc.extensao ? `Tipo: ${doc.extensao.toUpperCase()}` : null,
  ].filter(Boolean).join(' · ')
}

function isPreviewable(doc: CentralArquivosDocumento) {
  return doc.tipo_mime.startsWith('image/') || doc.tipo_mime === 'application/pdf'
}

export default function CentralArquivosPage({ role, initialPastas, initialDocumentos, initialError = null }: Props) {
  const [pastas, setPastas] = useState(initialPastas)
  const [documentos, setDocumentos] = useState(initialDocumentos)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [mensagem, setMensagem] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [categoria, setCategoria] = useState('')
  const [tipo, setTipo] = useState('')
  const [clienteFiltro, setClienteFiltro] = useState('')
  const [processoFiltro, setProcessoFiltro] = useState('')
  const [clienteFiltroOption, setClienteFiltroOption] = useState<SearchableComboboxOption | null>(null)
  const [processoFiltroOption, setProcessoFiltroOption] = useState<SearchableComboboxOption | null>(null)

  const [folderNome, setFolderNome] = useState('')
  const [folderDescricao, setFolderDescricao] = useState('')
  const [folderVisibilidade, setFolderVisibilidade] = useState('interna')
  const [folderClienteId, setFolderClienteId] = useState('')
  const [folderProcessoId, setFolderProcessoId] = useState('')
  const [folderCasoId, setFolderCasoId] = useState('')
  const [folderPaiId, setFolderPaiId] = useState('')
  const [folderClienteOption, setFolderClienteOption] = useState<SearchableComboboxOption | null>(null)
  const [folderProcessoOption, setFolderProcessoOption] = useState<SearchableComboboxOption | null>(null)
  const [folderPaiOption, setFolderPaiOption] = useState<SearchableComboboxOption | null>(null)

  const [uploadArquivos, setUploadArquivos] = useState<File[]>([])
  const [uploadPastaId, setUploadPastaId] = useState('')
  const [uploadClienteId, setUploadClienteId] = useState('')
  const [uploadProcessoId, setUploadProcessoId] = useState('')
  const [uploadCasoId, setUploadCasoId] = useState('')
  const [uploadCategoria, setUploadCategoria] = useState('')
  const [uploadDescricao, setUploadDescricao] = useState('')
  const [uploadVisibilidade, setUploadVisibilidade] = useState('interna')
  const [uploadClienteOption, setUploadClienteOption] = useState<SearchableComboboxOption | null>(null)
  const [uploadProcessoOption, setUploadProcessoOption] = useState<SearchableComboboxOption | null>(null)
  const [uploadPastaOption, setUploadPastaOption] = useState<SearchableComboboxOption | null>(null)

  const [selectedDocumentoId, setSelectedDocumentoId] = useState('')
  const [vinculoProcessoId, setVinculoProcessoId] = useState('')
  const [vinculoClienteId, setVinculoClienteId] = useState('')
  const [vinculoCasoId, setVinculoCasoId] = useState('')
  const [vinculoProcessoOption, setVinculoProcessoOption] = useState<SearchableComboboxOption | null>(null)
  const [vinculoClienteOption, setVinculoClienteOption] = useState<SearchableComboboxOption | null>(null)
  const [vinculoLoading, setVinculoLoading] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)

  const pastaOptions = useMemo(() => pastas.map(makeFolderOption), [pastas])
  const selectedDocumento = useMemo(
    () => documentos.find(doc => doc.id === selectedDocumentoId) ?? null,
    [documentos, selectedDocumentoId],
  )
  const canAnalyze = canAnalyzeWithAurora(role)

  async function fetchList<T>(url: string): Promise<T[]> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(await res.text())
    const body = await res.json()
    return Array.isArray(body?.items) ? body.items as T[] : []
  }

  async function carregarDados() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (categoria.trim()) params.set('categoria', categoria.trim())
      if (tipo.trim()) params.set('tipo', tipo.trim())
      if (clienteFiltro.trim()) params.set('cliente_id', clienteFiltro.trim())
      if (processoFiltro.trim()) params.set('processo_id', processoFiltro.trim())
      params.set('limit', '50')

      const [pastasData, docsData] = await Promise.all([
        fetchList<CentralArquivosPasta>(`/api/central-arquivos/pastas?${params.toString()}`),
        fetchList<CentralArquivosDocumento>(`/api/central-arquivos/documentos?${params.toString()}`),
      ])

      setPastas(pastasData)
      setDocumentos(docsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar Central de Arquivos.')
    } finally {
      setLoading(false)
    }
  }

  async function handleBuscar(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    await carregarDados()
  }

  async function handleCriarPasta(event: React.FormEvent) {
    event.preventDefault()
    setCreateLoading(true)
    setError(null)
    setMensagem(null)
    try {
      const res = await fetch('/api/central-arquivos/pastas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: folderNome,
          descricao: folderDescricao || null,
          cliente_id: folderClienteId || null,
          processo_id: folderProcessoId || null,
          caso_id: folderCasoId || null,
          pasta_pai_id: folderPaiId || null,
          visibilidade: folderVisibilidade,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? 'Não foi possível criar a pasta.')
      setFolderNome('')
      setFolderDescricao('')
      setFolderClienteId('')
      setFolderProcessoId('')
      setFolderCasoId('')
      setFolderPaiId('')
      setFolderClienteOption(null)
      setFolderProcessoOption(null)
      setFolderPaiOption(null)
      setMensagem('Pasta criada com sucesso.')
      await carregarDados()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar pasta.')
    } finally {
      setCreateLoading(false)
    }
  }

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault()
    setUploadLoading(true)
    setError(null)
    setMensagem(null)
    try {
      const form = new FormData()
      for (const file of uploadArquivos) {
        form.append('arquivos', file)
      }
      if (uploadPastaId) form.append('pasta_id', uploadPastaId)
      if (uploadClienteId) form.append('cliente_id', uploadClienteId)
      if (uploadProcessoId) form.append('processo_id', uploadProcessoId)
      if (uploadCasoId) form.append('caso_id', uploadCasoId)
      if (uploadCategoria.trim()) form.append('categoria', uploadCategoria.trim())
      if (uploadDescricao.trim()) form.append('descricao', uploadDescricao.trim())
      form.append('visibilidade', uploadVisibilidade)

      const res = await fetch('/api/central-arquivos/upload', {
        method: 'POST',
        body: form,
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? 'Não foi possível enviar os arquivos.')

      setUploadArquivos([])
      setUploadPastaId('')
      setUploadClienteId('')
      setUploadProcessoId('')
      setUploadCasoId('')
      setUploadCategoria('')
      setUploadDescricao('')
      setUploadPastaOption(null)
      setUploadClienteOption(null)
      setUploadProcessoOption(null)
      setMensagem('Arquivos enviados com sucesso.')
      await carregarDados()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no upload.')
    } finally {
      setUploadLoading(false)
    }
  }

  async function handleVincular(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedDocumentoId) return
    setVinculoLoading(true)
    setError(null)
    setMensagem(null)
    try {
      const res = await fetch('/api/central-arquivos/vinculos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documento_id: selectedDocumentoId,
          processo_id: vinculoProcessoId || null,
          cliente_id: vinculoClienteId || null,
          caso_id: vinculoCasoId || null,
          tipo_vinculo: 'processo',
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? 'Não foi possível salvar o vínculo.')
      setMensagem('Vínculo salvo com sucesso.')
      setSelectedDocumentoId('')
      setVinculoProcessoId('')
      setVinculoClienteId('')
      setVinculoCasoId('')
      setVinculoProcessoOption(null)
      setVinculoClienteOption(null)
      await carregarDados()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao vincular documento.')
    } finally {
      setVinculoLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-3)]">
          <FolderArchive size={14} />
          IA Jurídica · Aurora exclusiva para sócios
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-brand text-[30px] font-semibold text-[var(--color-ink)]">Dossiê Aurora</h1>
            <p className="text-[13px] text-[var(--color-ink-3)]">
              Central de documentos para análise jurídica da Aurora.
            </p>
          </div>
          {canAnalyze && (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-warm)] px-4 py-2 text-[13px] font-medium text-[var(--color-ink-3)] opacity-70 cursor-not-allowed"
            >
              <Sparkles size={14} />
              Analisar com Aurora
            </button>
          )}
        </div>
        <p className="text-[11px] text-[var(--color-ink-3)]">
          Esta ferramenta não usa IA. Os arquivos são usados apenas para a operação e não são salvos fora do sistema.
        </p>
        <p className="text-[11px] text-[var(--color-ink-3)]">
          Aqui você pode reunir documentos, fotos, áudios, prints, contratos, certidões, comprovantes e demais arquivos relacionados a um caso.
        </p>
        <p className="text-[11px] text-[var(--color-ink-3)]">
          Em fase posterior, a Aurora poderá analisar esse material, extrair fatos relevantes, montar linha do tempo, apontar documentos faltantes e sugerir peças ou providências jurídicas.
        </p>
      </header>

      {(error || mensagem) && (
        <div className={cn(
          'rounded-xl border px-4 py-3 text-[13px]',
          error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
        )}>
          {error ?? mensagem}
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <form onSubmit={handleBuscar} className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-[0_12px_36px_rgba(13,34,53,0.05)] space-y-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-ink)]">
            <Search size={14} />
            Buscar e filtrar
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5 text-[12px]">
              <span className="font-medium text-[var(--color-ink-2)]">Busca</span>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Nome, cliente, processo…"
                className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)]"
              />
            </label>
            <label className="space-y-1.5 text-[12px]">
              <span className="font-medium text-[var(--color-ink-2)]">Tipo</span>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)]"
              >
                {TIPOS_FILTRO.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-[12px]">
              <span className="font-medium text-[var(--color-ink-2)]">Categoria</span>
              <input
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
                placeholder="Categoria"
                className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)]"
              />
            </label>
            <div className="space-y-1.5 text-[12px]">
              <span className="font-medium text-[var(--color-ink-2)]">Cliente</span>
              <SearchableCombobox
                value={clienteFiltro}
                selectedOption={clienteFiltroOption}
                onChange={(value, option) => {
                  setClienteFiltro(value)
                  setClienteFiltroOption(option)
                }}
                loadOptions={fetchClienteOptions}
                placeholder="Filtrar por cliente"
                createLabel="Cadastrar cliente"
                createHref="/clientes/novo"
                minSearchLength={2}
                maxResults={10}
              />
            </div>
            <div className="space-y-1.5 text-[12px] md:col-span-2 xl:col-span-1">
              <span className="font-medium text-[var(--color-ink-2)]">Processo</span>
              <SearchableCombobox
                value={processoFiltro}
                selectedOption={processoFiltroOption}
                onChange={(value, option) => {
                  setProcessoFiltro(value)
                  setProcessoFiltroOption(option)
                }}
                loadOptions={fetchProcessoOptions}
                placeholder="Filtrar por processo"
                createLabel="Cadastrar processo"
                createHref="/processos/novo"
                minSearchLength={2}
                maxResults={10}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-copper)] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
            >
              {loading ? 'Buscando…' : 'Pesquisar'}
            </button>
            <button
              type="button"
            onClick={() => {
              setError(null)
              setMensagem(null)
              setQuery('')
              setCategoria('')
              setTipo('')
                setClienteFiltro('')
                setProcessoFiltro('')
                setClienteFiltroOption(null)
                setProcessoFiltroOption(null)
                void carregarDados()
              }}
              className="inline-flex items-center rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-[13px] font-medium text-[var(--color-ink-2)]"
            >
              Limpar filtros
            </button>
          </div>
        </form>

        <form onSubmit={handleCriarPasta} className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-[0_12px_36px_rgba(13,34,53,0.05)] space-y-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-ink)]">
            <FolderArchive size={14} />
            Criar pasta
          </div>
          <label className="space-y-1.5 text-[12px]">
            <span className="font-medium text-[var(--color-ink-2)]">Nome</span>
            <input
              value={folderNome}
              onChange={e => setFolderNome(e.target.value)}
              required
              className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)]"
              placeholder="Nome da pasta"
            />
          </label>
          <label className="space-y-1.5 text-[12px]">
            <span className="font-medium text-[var(--color-ink-2)]">Descrição</span>
            <textarea
              value={folderDescricao}
              onChange={e => setFolderDescricao(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)]"
              placeholder="Opcional"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 text-[12px]">
              <span className="font-medium text-[var(--color-ink-2)]">Cliente</span>
              <SearchableCombobox
                value={folderClienteId}
                selectedOption={folderClienteOption}
                onChange={(value, option) => {
                  setFolderClienteId(value)
                  setFolderClienteOption(option)
                }}
                loadOptions={fetchClienteOptions}
                placeholder="Vincular cliente"
                createLabel="Cadastrar cliente"
                createHref="/clientes/novo"
                minSearchLength={2}
                maxResults={10}
                allowClear
              />
            </div>
            <div className="space-y-1.5 text-[12px]">
              <span className="font-medium text-[var(--color-ink-2)]">Processo</span>
              <SearchableCombobox
                value={folderProcessoId}
                selectedOption={folderProcessoOption}
                onChange={(value, option) => {
                  setFolderProcessoId(value)
                  setFolderProcessoOption(option)
                }}
                loadOptions={fetchProcessoOptions}
                placeholder="Vincular processo"
                createLabel="Cadastrar processo"
                createHref="/processos/novo"
                minSearchLength={2}
                maxResults={10}
                allowClear
              />
            </div>
            <label className="space-y-1.5 text-[12px]">
              <span className="font-medium text-[var(--color-ink-2)]">Caso ID</span>
              <input
                value={folderCasoId}
                onChange={e => setFolderCasoId(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)]"
                placeholder="Opcional"
              />
            </label>
            <label className="space-y-1.5 text-[12px]">
              <span className="font-medium text-[var(--color-ink-2)]">Visibilidade</span>
              <select
                value={folderVisibilidade}
                onChange={e => setFolderVisibilidade(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)]"
              >
                <option value="interna">Interna</option>
                <option value="portal">Portal</option>
              </select>
            </label>
            <div className="space-y-1.5 text-[12px] md:col-span-2">
              <span className="font-medium text-[var(--color-ink-2)]">Pasta pai</span>
              <SearchableCombobox
                value={folderPaiId}
                options={pastaOptions}
                selectedOption={folderPaiOption}
                onChange={(value, option) => {
                  setFolderPaiId(value)
                  setFolderPaiOption(option)
                }}
                placeholder="Opcional"
                minSearchLength={0}
                maxResults={10}
                allowClear
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={createLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-copper)] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {createLoading ? 'Criando…' : 'Criar pasta'}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-[0_12px_36px_rgba(13,34,53,0.05)] space-y-4">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-ink)]">
          <Upload size={14} />
          Upload múltiplo
        </div>
        <form onSubmit={handleUpload} className="space-y-4">
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.mp3,.m4a,.wav,.xlsx,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/jpeg,image/png,audio/mpeg,audio/mp4,audio/wav,audio/x-wav,audio/x-m4a,audio/m4a,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            onChange={e => setUploadArquivos(Array.from(e.target.files ?? []))}
            className="block w-full rounded-xl border border-dashed border-[var(--color-border)] px-3 py-4 text-[13px]"
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5 text-[12px]">
              <span className="font-medium text-[var(--color-ink-2)]">Pasta</span>
              <SearchableCombobox
                value={uploadPastaId}
                options={pastaOptions}
                selectedOption={uploadPastaOption}
                onChange={(value, option) => {
                  setUploadPastaId(value)
                  setUploadPastaOption(option)
                }}
                placeholder="Salvar em pasta"
                minSearchLength={0}
                maxResults={10}
                allowClear
              />
            </div>
            <div className="space-y-1.5 text-[12px]">
              <span className="font-medium text-[var(--color-ink-2)]">Cliente</span>
              <SearchableCombobox
                value={uploadClienteId}
                selectedOption={uploadClienteOption}
                onChange={(value, option) => {
                  setUploadClienteId(value)
                  setUploadClienteOption(option)
                }}
                loadOptions={fetchClienteOptions}
                placeholder="Vincular cliente"
                createLabel="Cadastrar cliente"
                createHref="/clientes/novo"
                minSearchLength={2}
                maxResults={10}
                allowClear
              />
            </div>
            <div className="space-y-1.5 text-[12px]">
              <span className="font-medium text-[var(--color-ink-2)]">Processo</span>
              <SearchableCombobox
                value={uploadProcessoId}
                selectedOption={uploadProcessoOption}
                onChange={(value, option) => {
                  setUploadProcessoId(value)
                  setUploadProcessoOption(option)
                }}
                loadOptions={fetchProcessoOptions}
                placeholder="Vincular processo"
                createLabel="Cadastrar processo"
                createHref="/processos/novo"
                minSearchLength={2}
                maxResults={10}
                allowClear
              />
            </div>
            <label className="space-y-1.5 text-[12px]">
              <span className="font-medium text-[var(--color-ink-2)]">Caso ID</span>
              <input
                value={uploadCasoId}
                onChange={e => setUploadCasoId(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)]"
                placeholder="Opcional"
              />
            </label>
            <label className="space-y-1.5 text-[12px]">
              <span className="font-medium text-[var(--color-ink-2)]">Categoria</span>
              <input
                value={uploadCategoria}
                onChange={e => setUploadCategoria(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)]"
                placeholder="Ex.: contrato, prova, foto"
              />
            </label>
            <label className="space-y-1.5 text-[12px]">
              <span className="font-medium text-[var(--color-ink-2)]">Visibilidade</span>
              <select
                value={uploadVisibilidade}
                onChange={e => setUploadVisibilidade(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)]"
              >
                <option value="interna">Interna</option>
                <option value="portal">Portal</option>
              </select>
            </label>
            <label className="space-y-1.5 text-[12px] md:col-span-2">
              <span className="font-medium text-[var(--color-ink-2)]">Descrição</span>
              <input
                value={uploadDescricao}
                onChange={e => setUploadDescricao(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)]"
                placeholder="Observações opcionais"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={uploadLoading || uploadArquivos.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-sidebar)] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {uploadLoading ? 'Enviando…' : 'Enviar arquivos'}
          </button>
        </form>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-[0_12px_36px_rgba(13,34,53,0.05)]">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-ink)]">
            <FolderArchive size={14} />
            Pastas
          </div>
          <div className="mt-4 space-y-3">
            {pastas.length === 0 ? (
              <p className="text-[13px] text-[var(--color-ink-3)]">Nenhuma pasta encontrada.</p>
            ) : pastas.map(pasta => (
              <article key={pasta.id} className="rounded-xl border border-[var(--color-border)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[14px] font-semibold text-[var(--color-ink)]">{pasta.nome}</h3>
                    {pasta.descricao && <p className="mt-1 text-[12px] text-[var(--color-ink-3)]">{pasta.descricao}</p>}
                    <p className="mt-2 text-[11px] text-[var(--color-ink-3)]">
                      {pasta.cliente?.nome ? `${pasta.cliente.nome} · ` : ''}
                      {pasta.processo?.numero_processo ? `${pasta.processo.numero_processo} · ` : ''}
                      {pasta.visibilidade}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-[0_12px_36px_rgba(13,34,53,0.05)]">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-ink)]">
            <Download size={14} />
            Documentos
          </div>
          <div className="mt-4 space-y-3">
            {documentos.length === 0 ? (
              <p className="text-[13px] text-[var(--color-ink-3)]">Nenhum documento encontrado.</p>
            ) : documentos.map(doc => (
              <article key={doc.id} className="overflow-hidden rounded-xl border border-[var(--color-border)]">
                <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                  <div className="bg-[var(--color-surface-warm)] p-3">
                    {isPreviewable(doc) ? (
                      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-white">
                        {doc.tipo_mime.startsWith('image/') ? (
                          <img
                            src={`/api/central-arquivos/documentos/${doc.id}/download`}
                            alt={doc.nome_original}
                            className="h-28 w-full object-cover"
                          />
                        ) : (
                          <iframe
                            src={`/api/central-arquivos/documentos/${doc.id}/download`}
                            title={doc.nome_original}
                            className="h-28 w-full"
                          />
                        )}
                      </div>
                    ) : (
                      <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] text-center text-[11px] text-[var(--color-ink-3)]">
                        {doc.extensao?.toUpperCase() ?? 'ARQUIVO'}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-[14px] font-semibold text-[var(--color-ink)]">{doc.nome_original}</h3>
                        <p className="mt-1 text-[12px] text-[var(--color-ink-3)]">{makeDocumentoResumo(doc)}</p>
                      </div>
                      <span className="rounded-full bg-[var(--color-surface-warm)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-3)]">
                        {doc.status_processamento}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={`/api/central-arquivos/documentos/${doc.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-[12px] font-medium text-[var(--color-ink-2)]"
                      >
                        <Download size={13} />
                        Baixar
                      </a>
                      <button
                        type="button"
                        onClick={() => setSelectedDocumentoId(doc.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-[12px] font-medium text-[var(--color-ink-2)]"
                      >
                        <Link2 size={13} />
                        Vincular ao processo
                      </button>
                      {canAnalyze && (
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-[12px] font-medium text-[var(--color-ink-3)] opacity-60"
                        >
                          <Sparkles size={13} />
                          Analisar com Aurora
                        </button>
                      )}
                      {canAnalyze && (
                        <p className="text-[10px] text-[var(--color-ink-3)]">
                          Recurso em desenvolvimento para a próxima fase.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-[0_12px_36px_rgba(13,34,53,0.05)] space-y-4">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-ink)]">
          <Link2 size={14} />
          Vínculo de documento
        </div>
        <form onSubmit={handleVincular} className="space-y-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-warm)] p-3 text-[12px] text-[var(--color-ink-3)]">
            {selectedDocumento
              ? <>Documento selecionado: <span className="font-semibold text-[var(--color-ink)]">{selectedDocumento.nome_original}</span></>
              : 'Selecione um documento na lista acima para vincular ao processo.'}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5 text-[12px]">
              <span className="font-medium text-[var(--color-ink-2)]">Processo</span>
              <SearchableCombobox
                value={vinculoProcessoId}
                selectedOption={vinculoProcessoOption}
                onChange={(value, option) => {
                  setVinculoProcessoId(value)
                  setVinculoProcessoOption(option)
                }}
                loadOptions={fetchProcessoOptions}
                placeholder="Selecionar processo"
                createLabel="Cadastrar processo"
                createHref="/processos/novo"
                minSearchLength={2}
                maxResults={10}
              />
            </div>
            <div className="space-y-1.5 text-[12px]">
              <span className="font-medium text-[var(--color-ink-2)]">Cliente</span>
              <SearchableCombobox
                value={vinculoClienteId}
                selectedOption={vinculoClienteOption}
                onChange={(value, option) => {
                  setVinculoClienteId(value)
                  setVinculoClienteOption(option)
                }}
                loadOptions={fetchClienteOptions}
                placeholder="Opcional"
                createLabel="Cadastrar cliente"
                createHref="/clientes/novo"
                minSearchLength={2}
                maxResults={10}
                allowClear
              />
            </div>
            <label className="space-y-1.5 text-[12px]">
              <span className="font-medium text-[var(--color-ink-2)]">Caso ID</span>
              <input
                value={vinculoCasoId}
                onChange={e => setVinculoCasoId(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)]"
                placeholder="Opcional"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={!selectedDocumentoId || vinculoLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-copper)] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {vinculoLoading ? 'Vinculando…' : 'Salvar vínculo'}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}
