'use client'

import { useMemo, useState } from 'react'
import {
  Archive,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Pencil,
  Printer,
  Send,
  Sparkles,
  TimerReset,
} from 'lucide-react'
import type { UserRole } from '@/types'
import type {
  RelatorioClienteDraft,
  RelatorioConteudo,
  RelatorioStatus,
} from '@/lib/relatorios-inteligentes'
import {
  canApproveRelatorio,
  canArchiveRelatorio,
  canEditRelatorio,
  canGenerateRelatorio,
  canPublishRelatorio,
  canViewRelatorio,
} from '@/lib/relatorios-inteligentes/permissions'
import {
  RELATORIO_STATUS_LABELS,
  buildRelatorioPeriodoLabel,
  normalizeRelatorioConteudo,
} from '@/lib/relatorios-inteligentes/validation'

interface Props {
  processoId: string
  processoTitulo: string
  clienteNome: string
  role: UserRole
  relatoriosIniciais: RelatorioClienteDraft[]
}

interface FormState {
  titulo: string
  periodo_inicio: string
  periodo_fim: string
  resumoExecutivo: string
  principaisMovimentacoes: string
  situacaoAtual: string
  oQueIssoSignifica: string
  proximosPassos: string
  providenciasCliente: string
}

function toTextareaValue(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean).join('\n')
  return typeof value === 'string' ? value : ''
}

function fromTextareaValue(value: string) {
  return value
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean)
}

function buildForm(report: RelatorioClienteDraft): FormState {
  const conteudo = normalizeRelatorioConteudo(report.conteudo)
  return {
    titulo: report.titulo,
    periodo_inicio: report.periodo_inicio ?? '',
    periodo_fim: report.periodo_fim ?? '',
    resumoExecutivo: report.resumo_executivo || conteudo.resumoExecutivo,
    principaisMovimentacoes: toTextareaValue(conteudo.principaisMovimentacoes),
    situacaoAtual: conteudo.situacaoAtual,
    oQueIssoSignifica: conteudo.oQueIssoSignifica,
    proximosPassos: toTextareaValue(conteudo.proximosPassos),
    providenciasCliente: conteudo.providenciasCliente,
  }
}

function toPayload(form: FormState) {
  const conteudo: RelatorioConteudo = {
    resumoExecutivo: form.resumoExecutivo.trim(),
    principaisMovimentacoes: fromTextareaValue(form.principaisMovimentacoes),
    situacaoAtual: form.situacaoAtual.trim(),
    oQueIssoSignifica: form.oQueIssoSignifica.trim(),
    proximosPassos: fromTextareaValue(form.proximosPassos),
    providenciasCliente: form.providenciasCliente.trim(),
  }

  return {
    titulo: form.titulo.trim(),
    periodo_inicio: form.periodo_inicio || null,
    periodo_fim: form.periodo_fim || null,
    resumoExecutivo: conteudo.resumoExecutivo,
    principaisMovimentacoes: conteudo.principaisMovimentacoes,
    situacaoAtual: conteudo.situacaoAtual,
    oQueIssoSignifica: conteudo.oQueIssoSignifica,
    proximosPassos: conteudo.proximosPassos,
    providenciasCliente: conteudo.providenciasCliente,
  }
}

function formatDateTime(iso?: string | null) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function buildStatusClass(status: RelatorioStatus) {
  switch (status) {
    case 'rascunho':
      return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
    case 'pendente_aprovacao':
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
    case 'aprovado':
      return 'bg-sky-50 text-sky-700 ring-1 ring-sky-200'
    case 'publicado':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
    case 'arquivado':
      return 'bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200'
    default:
      return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
  }
}

export default function RelatoriosTab({
  processoId,
  processoTitulo,
  clienteNome,
  role,
  relatoriosIniciais,
}: Props) {
  const [items, setItems] = useState(relatoriosIniciais)
  const [selected, setSelected] = useState<RelatorioClienteDraft | null>(relatoriosIniciais[0] ?? null)
  const [form, setForm] = useState<FormState | null>(relatoriosIniciais[0] ? buildForm(relatoriosIniciais[0]) : null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFim, setPeriodoFim] = useState('')
  const [tituloBase, setTituloBase] = useState('')

  const canView = canViewRelatorio(role)
  const canGenerate = canGenerateRelatorio(role)
  const canEdit = canEditRelatorio(role)
  const canApprove = canApproveRelatorio(role)
  const canPublish = canPublishRelatorio(role)
  const canArchive = canArchiveRelatorio(role)

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')),
    [items],
  )

  const pdfUrl = selected ? `/api/processos/relatorios/${selected.id}/pdf` : ''
  const currentEditable = Boolean(selected && canEdit && ['rascunho', 'pendente_aprovacao'].includes(selected.status))
  const generatedLabel = useMemo(
    () => buildRelatorioPeriodoLabel(periodoInicio || null, periodoFim || null),
    [periodoInicio, periodoFim],
  )

  function syncItems(next: RelatorioClienteDraft[], selectedId?: string) {
    setItems(next)
    const selectedItem = selectedId
      ? next.find(item => item.id === selectedId)
      : null
    if (selectedItem) {
      setSelected(selectedItem)
      setForm(buildForm(selectedItem))
    }
  }

  function openReport(report: RelatorioClienteDraft) {
    setSelected(report)
    setForm(buildForm(report))
    setError('')
  }

  async function gerarRelatorio() {
    if (!canGenerate) return
    setLoading(true)
    setError('')

    const res = await fetch(`/api/processos/${processoId}/relatorios`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        titulo: tituloBase.trim() || undefined,
        periodo_inicio: periodoInicio || undefined,
        periodo_fim: periodoFim || undefined,
      }),
    })

    setLoading(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Falha ao gerar relatório')
      return
    }

    const draft = await res.json() as RelatorioClienteDraft
    const next = [draft, ...items.filter(item => item.id !== draft.id)]
    syncItems(next, draft.id)
  }

  async function salvar(status: RelatorioStatus = selected?.status ?? 'rascunho') {
    if (!selected || !form || !currentEditable) return
    setSaving(true)
    setError('')

    const res = await fetch(`/api/processos/relatorios/${selected.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...toPayload(form),
        status,
      }),
    })

    setSaving(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Falha ao salvar relatório')
      return
    }

    const updated = await res.json() as RelatorioClienteDraft
    syncItems(items.map(item => item.id === updated.id ? updated : item), updated.id)
  }

  async function aprovar() {
    if (!selected || !canApprove) return
    setSaving(true)
    setError('')

    const res = await fetch(`/api/processos/relatorios/${selected.id}/aprovar`, {
      method: 'POST',
    })

    setSaving(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Falha ao aprovar relatório')
      return
    }

    const updated = await res.json() as RelatorioClienteDraft
    syncItems(items.map(item => item.id === updated.id ? updated : item), updated.id)
  }

  async function publicar() {
    if (!selected || !canPublish) return
    setSaving(true)
    setError('')

    const res = await fetch(`/api/processos/relatorios/${selected.id}/publicar`, {
      method: 'POST',
    })

    setSaving(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Falha ao publicar relatório')
      return
    }

    const updated = await res.json() as RelatorioClienteDraft
    syncItems(items.map(item => item.id === updated.id ? updated : item), updated.id)
  }

  async function arquivar() {
    if (!selected || !canArchive) return
    if (!confirm('Arquivar este relatório?')) return

    setSaving(true)
    setError('')

    const res = await fetch(`/api/processos/relatorios/${selected.id}`, {
      method: 'DELETE',
    })

    setSaving(false)

    if (!res.ok && res.status !== 204) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Falha ao arquivar relatório')
      return
    }

    const updated = items.map(item => item.id === selected.id ? { ...item, status: 'arquivado' as RelatorioStatus } : item)
    syncItems(updated, selected.id)
  }

  function abrirPdf() {
    if (!selected) return
    window.open(pdfUrl, '_blank', 'noopener,noreferrer')
  }

  if (!canView) {
    return (
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-5">
        <p className="text-sm font-semibold text-[#1a1d23]">Relatórios</p>
        <p className="mt-1 text-sm text-[#6b7280]">Sem permissão para visualizar relatórios deste processo.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#9ca3af]">Relatórios Inteligentes</p>
            <h2 className="text-base font-semibold text-[#1a1d23]">Gerar Relatório</h2>
            <p className="text-sm text-[#6b7280] max-w-3xl">
              Gere um resumo executivo dos andamentos do processo em linguagem simples, revise manualmente e publique apenas após aprovação humana.
            </p>
          </div>

          <button
            onClick={gerarRelatorio}
            disabled={!canGenerate || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1D5F60] px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? 'Gerando...' : 'Gerar Relatório'}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">Título base</span>
            <input
              value={tituloBase}
              onChange={event => setTituloBase(event.target.value)}
              placeholder={`Relatório do processo ${processoTitulo}`}
              className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#1D5F60]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">Período inicial</span>
            <input
              type="date"
              value={periodoInicio}
              onChange={event => setPeriodoInicio(event.target.value)}
              className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#1D5F60]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">Período final</span>
            <input
              type="date"
              value={periodoFim}
              onChange={event => setPeriodoFim(event.target.value)}
              className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#1D5F60]"
            />
          </label>
        </div>

        <p className="text-xs text-[#6b7280]">
          Período selecionado: <strong>{generatedLabel}</strong>. O relatório será salvo como rascunho para revisão antes da aprovação.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#9ca3af]">Histórico</p>
              <p className="text-sm font-semibold text-[#1a1d23] mt-1">{items.length} relatório{items.length === 1 ? '' : 's'}</p>
            </div>
            <FileText size={16} className="text-[#1D5F60]" />
          </div>

          <div className="mt-4 space-y-3">
            {sortedItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#e5e7eb] p-4 text-sm text-[#6b7280]">
                Nenhum relatório gerado ainda.
              </div>
            ) : sortedItems.map(report => {
              const active = selected?.id === report.id
              return (
                <button
                  key={report.id}
                  onClick={() => openReport(report)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    active ? 'border-[#1D5F60] bg-[#f0f7f7]' : 'border-[#e5e7eb] bg-white hover:border-[#cbd5e1] hover:bg-[#fafafa]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1a1d23] truncate">{report.titulo}</p>
                      <p className="mt-1 text-xs text-[#6b7280]">{buildRelatorioPeriodoLabel(report.periodo_inicio, report.periodo_fim)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${buildStatusClass(report.status)}`}>
                      {RELATORIO_STATUS_LABELS[report.status] ?? report.status}
                    </span>
                  </div>

                  <div className="mt-3 text-[11px] text-[#6b7280] space-y-1">
                    <p>Gerado em {formatDateTime(report.created_at)}</p>
                    {report.approved_at && <p>Aprovado em {formatDateTime(report.approved_at)}</p>}
                    {report.published_at && <p>Publicado em {formatDateTime(report.published_at)}</p>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-lg border border-[#e5e7eb] bg-white p-5">
          {!selected || !form ? (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-[#e5e7eb] text-center">
              <FileText size={28} className="text-[#d1d5db]" />
              <p className="mt-3 text-sm font-semibold text-[#1a1d23]">Selecione um relatório</p>
              <p className="mt-1 max-w-md text-sm text-[#6b7280]">
                Escolha um item da lista para revisar, editar e avançar no fluxo de aprovação.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#9ca3af]">Relatório selecionado</p>
                  <h3 className="text-lg font-semibold text-[#1a1d23] mt-1">{selected.titulo}</h3>
                  <p className="text-sm text-[#6b7280]">
                    {clienteNome} · {buildRelatorioPeriodoLabel(selected.periodo_inicio, selected.periodo_fim)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${buildStatusClass(selected.status)}`}>
                    {RELATORIO_STATUS_LABELS[selected.status] ?? selected.status}
                  </span>
                  <button
                    onClick={abrirPdf}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] px-3 py-2 text-xs font-medium text-[#374151] hover:bg-[#fafafa]"
                  >
                    <Download size={13} /> PDF
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] px-3 py-2 text-xs font-medium text-[#374151] hover:bg-[#fafafa]"
                  >
                    <Printer size={13} /> Imprimir
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">Título</span>
                  <input
                    value={form.titulo}
                    onChange={event => setForm(prev => prev ? { ...prev, titulo: event.target.value } : prev)}
                    disabled={!currentEditable}
                    className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#1D5F60] disabled:bg-[#f9fafb]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">Status</span>
                  <input
                    value={RELATORIO_STATUS_LABELS[selected.status] ?? selected.status}
                    disabled
                    className="w-full rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-3 py-2 text-sm text-[#6b7280]"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">Período inicial</span>
                  <input
                    type="date"
                    value={form.periodo_inicio}
                    onChange={event => setForm(prev => prev ? { ...prev, periodo_inicio: event.target.value } : prev)}
                    disabled={!currentEditable}
                    className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#1D5F60] disabled:bg-[#f9fafb]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">Período final</span>
                  <input
                    type="date"
                    value={form.periodo_fim}
                    onChange={event => setForm(prev => prev ? { ...prev, periodo_fim: event.target.value } : prev)}
                    disabled={!currentEditable}
                    className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#1D5F60] disabled:bg-[#f9fafb]"
                  />
                </label>
              </div>

              <div className="grid gap-4">
                <FieldEditor
                  label="Resumo executivo"
                  value={form.resumoExecutivo}
                  onChange={value => setForm(prev => prev ? { ...prev, resumoExecutivo: value } : prev)}
                  disabled={!currentEditable}
                />
                <FieldEditor
                  label="Principais movimentações"
                  value={form.principaisMovimentacoes}
                  onChange={value => setForm(prev => prev ? { ...prev, principaisMovimentacoes: value } : prev)}
                  disabled={!currentEditable}
                  helpText="Use uma linha por movimentação."
                />
                <FieldEditor
                  label="Situação atual"
                  value={form.situacaoAtual}
                  onChange={value => setForm(prev => prev ? { ...prev, situacaoAtual: value } : prev)}
                  disabled={!currentEditable}
                />
                <FieldEditor
                  label="O que isso significa"
                  value={form.oQueIssoSignifica}
                  onChange={value => setForm(prev => prev ? { ...prev, oQueIssoSignifica: value } : prev)}
                  disabled={!currentEditable}
                />
                <FieldEditor
                  label="Próximos passos"
                  value={form.proximosPassos}
                  onChange={value => setForm(prev => prev ? { ...prev, proximosPassos: value } : prev)}
                  disabled={!currentEditable}
                  helpText="Use uma linha por próximo passo."
                />
                <FieldEditor
                  label="Providências do cliente"
                  value={form.providenciasCliente}
                  onChange={value => setForm(prev => prev ? { ...prev, providenciasCliente: value } : prev)}
                  disabled={!currentEditable}
                />
              </div>

              <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#9ca3af]">Versões e revisão</p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <MetaBox label="Gerado em" value={formatDateTime(selected.created_at)} />
                  <MetaBox
                    label="Aprovado em"
                    value={formatDateTime(selected.approved_at)}
                    subtitle={selected.aprovado_por_profile?.nome ?? '—'}
                  />
                  <MetaBox
                    label="Publicado em"
                    value={formatDateTime(selected.published_at)}
                    subtitle={selected.publicado_por_profile?.nome ?? '—'}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {currentEditable && (
                  <button
                    onClick={() => salvar('rascunho')}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] px-4 py-2.5 text-sm font-medium text-[#374151] hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Pencil size={14} /> {saving ? 'Salvando...' : 'Salvar rascunho'}
                  </button>
                )}
                {currentEditable && (
                  <button
                    onClick={() => salvar('pendente_aprovacao')}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#1D5F60] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#184d4d] disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <Send size={14} /> Enviar para aprovação
                  </button>
                )}
                {canApprove && selected.status === 'pendente_aprovacao' && (
                  <button
                    onClick={aprovar}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  >
                    <CheckCircle2 size={14} /> Aprovar
                  </button>
                )}
                {canPublish && selected.status === 'aprovado' && (
                  <button
                    onClick={publicar}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
                  >
                    <Check size={14} /> Publicar
                  </button>
                )}
                {canArchive && selected.status !== 'arquivado' && (
                  <button
                    onClick={arquivar}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Archive size={14} /> Arquivar
                  </button>
                )}
                {!currentEditable && selected.status !== 'publicado' && (
                  <span className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
                    <TimerReset size={14} /> Apenas leitura neste status.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FieldEditor({
  label,
  value,
  onChange,
  disabled,
  helpText,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  helpText?: string
}) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">{label}</span>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        disabled={disabled}
        rows={4}
        className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#1D5F60] disabled:bg-[#f9fafb]"
      />
      {helpText && <p className="text-[11px] text-[#6b7280]">{helpText}</p>}
    </label>
  )
}

function MetaBox({
  label,
  value,
  subtitle,
}: {
  label: string
  value: string
  subtitle?: string
}) {
  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#1a1d23]">{value}</p>
      {subtitle && <p className="mt-1 text-[11px] text-[#6b7280]">{subtitle}</p>}
    </div>
  )
}
