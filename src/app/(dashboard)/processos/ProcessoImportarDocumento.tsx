'use client'

import { type ChangeEvent, type ReactNode, useRef, useState } from 'react'
import {
  Check,
  FileUp,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import {
  buildObservacoesImportacao,
  normalizeProcessoImportacao,
  PROCESSO_IMPORTACAO_VAZIA,
  type ProcessoImportacaoDados,
  type ProcessoImportacaoModoAplicacao,
} from '@/lib/processos/importar-documento'

const ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PANEL_CLASS = 'rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_12px_36px_rgba(13,34,53,0.05)]'
const INPUT_CLASS = 'w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/10'
const LABEL_CLASS = 'block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-2)] mb-1.5'

interface ProcessoImportarDocumentoProps {
  enabled: boolean
  onApply: (dados: ProcessoImportacaoDados, modo: ProcessoImportacaoModoAplicacao) => Promise<void> | void
}

function toTextareaValue(items: string[]) {
  return items.join('\n')
}

function fromTextareaValue(value: string) {
  return value
    .split(/\r?\n/)
    .map(item => item.trim().replace(/^[-–—*]+\s*/, ''))
    .filter(Boolean)
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return '—'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export default function ProcessoImportarDocumento({ enabled, onApply }: ProcessoImportarDocumentoProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number; type: string } | null>(null)
  const [mode, setMode] = useState<ProcessoImportacaoModoAplicacao>('preencher_vazios')
  const [draft, setDraft] = useState<ProcessoImportacaoDados>(PROCESSO_IMPORTACAO_VAZIA)

  function openPicker() {
    setError('')
    inputRef.current?.click()
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!enabled) {
      setError('Você não tem permissão para importar documentos neste processo.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('documento', file)

      const response = await fetch('/api/processos/importar-documento', {
        method: 'POST',
        body: formData,
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Não foi possível analisar o documento.')
      }

      setFileInfo({ name: payload.arquivo?.nome ?? file.name, size: payload.arquivo?.tamanho ?? file.size, type: payload.arquivo?.tipo ?? file.type })
      setDraft(normalizeProcessoImportacao(payload.dados ?? PROCESSO_IMPORTACAO_VAZIA))
      setMode('preencher_vazios')
      setModalOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível analisar o documento.')
    } finally {
      setLoading(false)
    }
  }

  function closeModal() {
    setModalOpen(false)
    setFileInfo(null)
    setDraft(PROCESSO_IMPORTACAO_VAZIA)
    setMode('preencher_vazios')
  }

  function updateCliente(field: keyof ProcessoImportacaoDados['cliente'], value: string) {
    setDraft(prev => ({ ...prev, cliente: { ...prev.cliente, [field]: value } }))
  }

  function updateParteContraria(field: keyof ProcessoImportacaoDados['parteContraria'], value: string) {
    setDraft(prev => ({ ...prev, parteContraria: { ...prev.parteContraria, [field]: value } }))
  }

  function updateProcesso(field: keyof ProcessoImportacaoDados['processo'], value: string | boolean | null) {
    setDraft(prev => ({ ...prev, processo: { ...prev.processo, [field]: value } }))
  }

  function updateResumo(field: keyof ProcessoImportacaoDados['resumo'], value: string) {
    setDraft(prev => ({
      ...prev,
      resumo: {
        ...prev.resumo,
        [field]: field === 'resumoCaso' ? value : fromTextareaValue(value),
      },
    }))
  }

  function updateObservacoes(field: keyof ProcessoImportacaoDados['observacoes'], value: string) {
    setDraft(prev => ({
      ...prev,
      observacoes: {
        ...prev.observacoes,
        [field]: field === 'observacoesInternas' ? value : fromTextareaValue(value),
      },
    }))
  }

  function updateAdvogado(index: number, field: 'nome' | 'oab' | 'representa', value: string) {
    setDraft(prev => ({
      ...prev,
      advogados: prev.advogados.map((item, idx) => idx === index ? { ...item, [field]: value } : item),
    }))
  }

  function addAdvogado() {
    setDraft(prev => ({
      ...prev,
      advogados: [...prev.advogados, { nome: '', oab: '', representa: '' }],
    }))
  }

  function removeAdvogado(index: number) {
    setDraft(prev => ({
      ...prev,
      advogados: prev.advogados.filter((_, idx) => idx !== index),
    }))
  }

  async function handleApply() {
    try {
      await onApply(draft, mode)
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível aplicar os dados ao formulário.')
    }
  }

  if (!enabled) return null

  return (
    <>
      <div className={PANEL_CLASS}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-copper)]">
              Importar dados do processo por documento
            </p>
            <h2 className="font-brand text-[22px] font-semibold text-[var(--color-ink)]">
              Importar dados do processo por documento
            </h2>
            <p className="text-[13px] text-[var(--color-ink-3)] max-w-3xl">
              Envie um PDF, DOC ou DOCX para extrair dados principais do processo e revisar tudo antes de aplicar ao formulário.
            </p>
          </div>

          <button
            type="button"
            onClick={openPicker}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-sidebar)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-petrol)] disabled:opacity-60"
            disabled={loading}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
            {loading ? 'Analisando documento...' : 'Importar documento'}
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Revise os dados antes de aplicar. A extração automática pode conter erros.
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={handleFileChange}
      />

      {modalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-[0_32px_96px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-6 py-5">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-copper)]">
                  Revisar dados encontrados
                </p>
                <h3 className="font-brand text-[24px] font-semibold text-[var(--color-ink)]">
                  Revisar dados encontrados
                </h3>
                <p className="text-sm text-[var(--color-ink-3)]">
                  {fileInfo ? `${fileInfo.name} · ${formatFileSize(fileInfo.size)} · ${fileInfo.type || 'tipo não informado'}` : 'Documento analisado'}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-2 text-[var(--color-ink-3)] transition hover:bg-[var(--color-surface-warm)] hover:text-[var(--color-ink)]"
                aria-label="Fechar revisão"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(92vh-160px)] overflow-y-auto px-6 py-5">
              <div className="mb-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                Você pode editar cada campo antes de aplicar. Escolha abaixo como os valores serão aplicados ao formulário.
              </div>

              <div className="mb-6 grid gap-3 md:grid-cols-3">
                {[
                  { value: 'preencher_vazios', label: 'Preencher campos vazios' },
                  { value: 'substituir', label: 'Substituir valores existentes' },
                ].map(option => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                      mode === option.value ? 'border-[var(--color-copper)] bg-[rgba(217,159,71,0.08)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="modo-importacao"
                      checked={mode === option.value}
                      onChange={() => setMode(option.value as ProcessoImportacaoModoAplicacao)}
                    />
                    <span className="text-sm font-medium text-[var(--color-ink)]">{option.label}</span>
                  </label>
                ))}
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="Cliente">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nome" value={draft.cliente.nome} onChange={value => updateCliente('nome', value)} />
                    <Field label="CPF/CNPJ" value={draft.cliente.cpfCnpj} onChange={value => updateCliente('cpfCnpj', value)} />
                    <Field label="Telefone" value={draft.cliente.telefone} onChange={value => updateCliente('telefone', value)} />
                    <Field label="E-mail" value={draft.cliente.email} onChange={value => updateCliente('email', value)} />
                    <Field label="Endereço" value={draft.cliente.endereco} onChange={value => updateCliente('endereco', value)} className="md:col-span-2" />
                  </div>
                </Panel>

                <Panel title="Parte contrária">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nome" value={draft.parteContraria.nome} onChange={value => updateParteContraria('nome', value)} />
                    <Field label="CPF/CNPJ" value={draft.parteContraria.cpfCnpj} onChange={value => updateParteContraria('cpfCnpj', value)} />
                    <Field label="Endereço" value={draft.parteContraria.endereco} onChange={value => updateParteContraria('endereco', value)} className="md:col-span-2" />
                  </div>
                </Panel>

                <Panel title="Processo">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Número" value={draft.processo.numero} onChange={value => updateProcesso('numero', value)} className="md:col-span-2" />
                    <Field label="Comarca" value={draft.processo.comarca} onChange={value => updateProcesso('comarca', value)} />
                    <Field label="Vara" value={draft.processo.vara} onChange={value => updateProcesso('vara', value)} />
                    <Field label="Tribunal" value={draft.processo.tribunal} onChange={value => updateProcesso('tribunal', value)} />
                    <Field label="Classe processual" value={draft.processo.classe} onChange={value => updateProcesso('classe', value)} />
                    <Field label="Assunto" value={draft.processo.assunto} onChange={value => updateProcesso('assunto', value)} />
                    <Field label="Fase processual" value={draft.processo.fase} onChange={value => updateProcesso('fase', value)} className="md:col-span-2" />
                    <Field label="Data de distribuição" type="date" value={draft.processo.dataDistribuicao} onChange={value => updateProcesso('dataDistribuicao', value)} />
                    <Field label="Valor da causa" type="number" value={draft.processo.valorCausa} onChange={value => updateProcesso('valorCausa', value)} />
                    <div className="md:col-span-2">
                      <label className={LABEL_CLASS}>Segredo de justiça</label>
                      <select
                        className={INPUT_CLASS}
                        value={draft.processo.segredoJustica === null ? '' : draft.processo.segredoJustica ? 'true' : 'false'}
                        onChange={(e) => updateProcesso('segredoJustica', e.target.value === '' ? null : e.target.value === 'true')}
                      >
                        <option value="">Não informado</option>
                        <option value="true">Sim</option>
                        <option value="false">Não</option>
                      </select>
                    </div>
                  </div>
                </Panel>

                <Panel title="Advogados">
                  <div className="space-y-3">
                    {draft.advogados.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-ink-3)]">
                        Nenhum advogado identificado.
                      </p>
                    ) : draft.advogados.map((advogado, index) => (
                      <div key={`${index}-${advogado.nome || 'adv'}`} className="rounded-2xl border border-[var(--color-border)] p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[var(--color-ink)]">Advogado {index + 1}</p>
                          <button
                            type="button"
                            onClick={() => removeAdvogado(index)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700"
                          >
                            <Trash2 size={12} /> Remover
                          </button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                          <Field label="Nome" value={advogado.nome} onChange={value => updateAdvogado(index, 'nome', value)} />
                          <Field label="OAB" value={advogado.oab} onChange={value => updateAdvogado(index, 'oab', value)} />
                          <Field label="Representa" value={advogado.representa} onChange={value => updateAdvogado(index, 'representa', value)} />
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addAdvogado}
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-warm)]"
                    >
                      <Plus size={14} /> Adicionar advogado
                    </button>
                  </div>
                </Panel>

                <Panel title="Resumo">
                  <div className="space-y-4">
                    <div>
                      <label className={LABEL_CLASS}>Resumo do caso</label>
                      <textarea
                        className={`${INPUT_CLASS} min-h-[110px] resize-y`}
                        value={draft.resumo.resumoCaso}
                        onChange={(e) => updateResumo('resumoCaso', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Fatos relevantes</label>
                      <textarea
                        className={`${INPUT_CLASS} min-h-[100px] resize-y font-mono text-[12px]`}
                        value={toTextareaValue(draft.resumo.fatosRelevantes)}
                        onChange={(e) => updateResumo('fatosRelevantes', e.target.value)}
                        placeholder="Uma linha por item"
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Pedidos principais</label>
                      <textarea
                        className={`${INPUT_CLASS} min-h-[100px] resize-y font-mono text-[12px]`}
                        value={toTextareaValue(draft.resumo.pedidosPrincipais)}
                        onChange={(e) => updateResumo('pedidosPrincipais', e.target.value)}
                        placeholder="Uma linha por item"
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Prazos mencionados</label>
                      <textarea
                        className={`${INPUT_CLASS} min-h-[100px] resize-y font-mono text-[12px]`}
                        value={toTextareaValue(draft.resumo.prazosMencionados)}
                        onChange={(e) => updateResumo('prazosMencionados', e.target.value)}
                        placeholder="Uma linha por item"
                      />
                    </div>
                  </div>
                </Panel>

                <Panel title="Observações">
                  <div className="space-y-4">
                    <div>
                      <label className={LABEL_CLASS}>Campos não encontrados</label>
                      <textarea
                        className={`${INPUT_CLASS} min-h-[100px] resize-y font-mono text-[12px]`}
                        value={toTextareaValue(draft.observacoes.camposNaoEncontrados)}
                        onChange={(e) => updateObservacoes('camposNaoEncontrados', e.target.value)}
                        placeholder="Uma linha por item"
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Inconsistências identificadas</label>
                      <textarea
                        className={`${INPUT_CLASS} min-h-[100px] resize-y font-mono text-[12px]`}
                        value={toTextareaValue(draft.observacoes.inconsistencias)}
                        onChange={(e) => updateObservacoes('inconsistencias', e.target.value)}
                        placeholder="Uma linha por item"
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Observações internas</label>
                      <textarea
                        className={`${INPUT_CLASS} min-h-[120px] resize-y`}
                        value={draft.observacoes.observacoesInternas}
                        onChange={(e) => updateObservacoes('observacoesInternas', e.target.value)}
                      />
                    </div>
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-warm)] px-4 py-3 text-sm text-[var(--color-ink-2)]">
                      <strong className="text-[var(--color-ink)]">Prévia das observações:</strong>
                      <pre className="mt-2 whitespace-pre-wrap text-[12px] leading-5">{buildObservacoesImportacao(draft) || 'Nada a registrar.'}</pre>
                    </div>
                  </div>
                </Panel>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-[var(--color-border)] pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--color-ink-3)] transition hover:text-[var(--color-ink)]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-sidebar)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-petrol)]"
                >
                  <Check size={16} /> Aplicar ao formulário
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h4 className="mb-4 text-sm font-semibold text-[var(--color-ink)]">{title}</h4>
      {children}
    </section>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  className = '',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'date' | 'number'
  className?: string
}) {
  return (
    <div className={className}>
      <label className={LABEL_CLASS}>{label}</label>
      <input
        className={INPUT_CLASS}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
