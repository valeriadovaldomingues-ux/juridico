'use client'

// ─────────────────────────────────────────────────────────────────────────────
// ImportarAgendaPage.tsx
//
// Fluxo: idle → uploading → preview → confirming → done (ou error)
//
// 1. Usuário arrasta / seleciona um CSV do EasyJur
// 2. POST /api/agenda-import/preview → classifica as linhas
// 3. Exibe tabela de preview + badges de contagem
// 4. Usuário confirma → POST /api/agenda-import/confirm → resultado final
// 5. Opcionalmente baixa relatório de erros em CSV
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react'
import {
  Upload, FileText, CheckCircle2, AlertCircle, RefreshCw,
  ChevronDown, ChevronUp, Download, X, ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import type { PreviewResult, ConfirmResult, PreviewRow } from '@/types/agenda-import'

// ─── Tipos de estado da máquina de estados ────────────────────────────────────

type Stage =
  | { name: 'idle' }
  | { name: 'uploading' }
  | { name: 'preview';    result: PreviewResult; file: File }
  | { name: 'confirming'; result: PreviewResult; file: File }
  | { name: 'done';       result: ConfirmResult; filename: string }
  | { name: 'error';      message: string }

// ─── Constantes de estilo ─────────────────────────────────────────────────────

const ROW_STATUS_CFG = {
  new: {
    label: 'Novo',
    bg:    'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70',
    dot:   'bg-emerald-500',
  },
  update: {
    label: 'Atualização',
    bg:    'bg-blue-50 text-blue-700 ring-1 ring-blue-200/70',
    dot:   'bg-blue-500',
  },
  duplicate: {
    label: 'Duplicado',
    bg:    'bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200/70',
    dot:   'bg-zinc-400',
  },
  error: {
    label: 'Erro',
    bg:    'bg-red-50 text-red-700 ring-1 ring-red-200/70',
    dot:   'bg-red-500',
  },
} as const

// ─── Utilitário: gerar CSV de erros ──────────────────────────────────────────

function downloadErrorsCsv(result: ConfirmResult, filename: string) {
  if (result.errorRows.length === 0) return

  // Coleta todos os cabeçalhos presentes nas linhas de erro
  const allKeys = [...new Set(result.errorRows.flatMap(r => Object.keys(r.raw)))]
  const headers = ['Linha', 'Erro', ...allKeys]

  const csvLines = [
    headers.join(';'),
    ...result.errorRows.map(r => {
      const values = [
        r.rowNumber,
        `"${(r.error ?? '').replace(/"/g, '""')}"`,
        ...allKeys.map(k => `"${(r.raw[k] ?? '').replace(/"/g, '""')}"`),
      ]
      return values.join(';')
    }),
  ]

  const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `erros_importacao_${filename.replace('.csv', '')}_${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Badge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`flex flex-col items-center px-5 py-3 rounded-xl border ${color}`}>
      <span className="text-2xl font-bold tabular-nums">{count}</span>
      <span className="text-[11px] font-medium mt-0.5 opacity-80">{label}</span>
    </div>
  )
}

function RowStatusBadge({ status }: { status: PreviewRow['rowStatus'] }) {
  const cfg = ROW_STATUS_CFG[status]
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────

function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) onFile(f)
    // Reset para permitir re-upload do mesmo arquivo
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        relative flex flex-col items-center justify-center gap-4 w-full
        border-2 border-dashed rounded-2xl p-14 cursor-pointer
        transition-all duration-150 select-none
        ${dragging
          ? 'border-[#145A5B] bg-[#E8F0F0]'
          : 'border-[#D0DCDC] bg-white hover:border-[#145A5B]/50 hover:bg-[#f9fafb]'
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleChange}
      />

      <div className={`
        w-14 h-14 rounded-2xl flex items-center justify-center transition-colors
        ${dragging ? 'bg-[#145A5B]' : 'bg-[#f3f4f6]'}
      `}>
        <Upload size={24} className={dragging ? 'text-white' : 'text-[#9ca3af]'} />
      </div>

      <div className="text-center space-y-1">
        <p className="text-[15px] font-semibold text-[#1a1d23]">
          {dragging ? 'Solte o arquivo aqui' : 'Arraste o CSV do EasyJur'}
        </p>
        <p className="text-[13px] text-[#9ca3af]">
          ou clique para selecionar &middot; Apenas <strong>.csv</strong>
        </p>
      </div>

      <div className="flex items-center gap-6 text-[11px] text-[#9ca3af] mt-2">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> UTF-8 e latin1
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Vírgula e ponto-e-vírgula
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> Datas dd/mm/yyyy
        </span>
      </div>
    </div>
  )
}

// ─── Tabela de Preview ────────────────────────────────────────────────────────

const PREVIEW_COLS = [
  { key: 'rowNumber',       label: '#',            width: 'w-12' },
  { key: 'rowStatus',       label: 'Status',       width: 'w-28' },
  { key: 'data_inicio',     label: 'Data',         width: 'w-28' },
  { key: 'tipo',            label: 'Tipo',         width: 'w-28' },
  { key: 'responsible_name', label: 'Responsável', width: 'w-40' },
  { key: 'process_number',  label: 'Processo',     width: 'w-40' },
  { key: 'titulo',          label: 'Título',       width: '' },
  { key: 'errorMessage',    label: 'Erro',         width: 'w-52' },
] as const

function PreviewTable({ rows }: { rows: PreviewRow[] }) {
  const [showAll, setShowAll]   = useState(false)
  const [filter, setFilter]     = useState<PreviewRow['rowStatus'] | 'all'>('all')

  const filtered  = filter === 'all' ? rows : rows.filter(r => r.rowStatus === filter)
  const displayed = showAll ? filtered : filtered.slice(0, 20)

  function formatDate(iso: string): string {
    if (!iso) return '—'
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  return (
    <div className="space-y-3">
      {/* Filtros rápidos */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'new', 'update', 'duplicate', 'error'] as const).map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setShowAll(false) }}
            className={`
              text-[11px] font-semibold px-3 py-1 rounded-full transition-colors
              ${filter === f
                ? 'bg-[#0F3D3E] text-white'
                : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'
              }
            `}
          >
            {f === 'all' ? `Todos (${rows.length})` : (
              <>
                {ROW_STATUS_CFG[f].label}
                {' '}({rows.filter(r => r.rowStatus === f).length})
              </>
            )}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="rounded-2xl border border-[#e5e7eb] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#f9fafb] border-b border-[#f3f4f6]">
                {PREVIEW_COLS.map(col => (
                  <th key={col.key} className={`px-3 py-2.5 text-left font-semibold text-[#9ca3af] uppercase tracking-wide text-[10px] whitespace-nowrap ${col.width}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f9fafb]">
              {displayed.map(row => (
                <tr
                  key={row.rowNumber}
                  className={`transition-colors ${row.rowStatus === 'error' ? 'bg-red-50/40' : 'hover:bg-[#fafafa]'}`}
                >
                  <td className="px-3 py-2.5 text-[#9ca3af] font-mono">{row.rowNumber}</td>
                  <td className="px-3 py-2.5"><RowStatusBadge status={row.rowStatus} /></td>
                  <td className="px-3 py-2.5 text-[#374151] whitespace-nowrap">{formatDate(row.data_inicio)}</td>
                  <td className="px-3 py-2.5 text-[#374151] capitalize">{row.tipo}</td>
                  <td className="px-3 py-2.5 text-[#374151] max-w-[160px] truncate">{row.responsible_name ?? '—'}</td>
                  <td className="px-3 py-2.5 text-[#374151] max-w-[160px] truncate font-mono text-[11px]">{row.process_number ?? '—'}</td>
                  <td className="px-3 py-2.5 text-[#1a1d23] font-medium max-w-[280px] truncate">{row.titulo}</td>
                  <td className="px-3 py-2.5 text-red-600 max-w-[210px] truncate text-[11px]">{row.errorMessage ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Expandir / recolher */}
        {filtered.length > 20 && (
          <button
            onClick={() => setShowAll(v => !v)}
            className="w-full flex items-center justify-center gap-1.5 py-3 text-[12px] text-[#6b7280] hover:text-[#0F3D3E] hover:bg-[#f9fafb] transition-colors border-t border-[#f3f4f6]"
          >
            {showAll
              ? <><ChevronUp size={13} /> Mostrar menos</>
              : <><ChevronDown size={13} /> Mostrar todas as {filtered.length} linhas</>
            }
          </button>
        )}

        {displayed.length === 0 && (
          <div className="flex items-center justify-center h-24 text-[13px] text-[#9ca3af]">
            Nenhuma linha nesta categoria
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Resultado final ──────────────────────────────────────────────────────────

function DoneScreen({
  result,
  filename,
  onReset,
}: {
  result: ConfirmResult
  filename: string
  onReset: () => void
}) {
  const hasErrors = result.errors > 0

  return (
    <div className="space-y-6">
      {/* Ícone + título */}
      <div className="flex flex-col items-center gap-3 py-6">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${hasErrors ? 'bg-amber-50' : 'bg-emerald-50'}`}>
          {hasErrors
            ? <AlertCircle size={32} className="text-amber-500" />
            : <CheckCircle2 size={32} className="text-emerald-500" />
          }
        </div>
        <div className="text-center">
          <h2 className="text-[18px] font-bold text-[#0f1923]">
            {hasErrors ? 'Importação concluída com avisos' : 'Importação concluída!'}
          </h2>
          <p className="text-[13px] text-[#9ca3af] mt-1">{filename}</p>
        </div>
      </div>

      {/* Badges de resultado */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Badge label="Criados"     count={result.created} color="bg-emerald-50 border-emerald-200 text-emerald-700" />
        <Badge label="Atualizados" count={result.updated} color="bg-blue-50 border-blue-200 text-blue-700" />
        <Badge label="Ignorados"   count={result.skipped} color="bg-zinc-50 border-zinc-200 text-zinc-500" />
        <Badge label="Com erro"    count={result.errors}  color={result.errors > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-zinc-50 border-zinc-200 text-zinc-400'} />
      </div>

      {/* Ações */}
      <div className="flex flex-col sm:flex-row gap-3">
        {hasErrors && (
          <button
            onClick={() => downloadErrorsCsv(result, filename)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 text-[13px] font-medium rounded-xl border border-red-200 transition-colors"
          >
            <Download size={14} /> Baixar relatório de erros ({result.errors})
          </button>
        )}
        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#f3f4f6] hover:bg-[#e5e7eb] text-[#374151] text-[13px] font-medium rounded-xl transition-colors"
        >
          <RefreshCw size={14} /> Nova importação
        </button>
        <Link
          href="/agenda"
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0F3D3E] hover:bg-[#145A5B] text-white text-[13px] font-medium rounded-xl transition-colors"
        >
          Ver agenda
        </Link>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ImportarAgendaPage() {
  const [stage, setStage] = useState<Stage>({ name: 'idle' })

  // ── Upload → Preview ────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    setStage({ name: 'uploading' })

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch('/api/agenda-import/preview', { method: 'POST', body: form })
      const json = await res.json()

      if (!res.ok) {
        setStage({ name: 'error', message: json.error ?? 'Erro ao processar o arquivo' })
        return
      }

      setStage({ name: 'preview', result: json as PreviewResult, file })
    } catch (err: any) {
      setStage({ name: 'error', message: 'Erro de rede: ' + err.message })
    }
  }, [])

  // ── Preview → Confirm ───────────────────────────────────────────────────────

  const handleConfirm = useCallback(async (result: PreviewResult, file: File) => {
    setStage({ name: 'confirming', result, file })

    const form = new FormData()
    form.append('file', file)

    try {
      const res  = await fetch('/api/agenda-import/confirm', { method: 'POST', body: form })
      const json = await res.json()

      if (!res.ok) {
        setStage({ name: 'error', message: json.error ?? 'Erro durante a importação' })
        return
      }

      setStage({ name: 'done', result: json as ConfirmResult, filename: file.name })
    } catch (err: any) {
      setStage({ name: 'error', message: 'Erro de rede: ' + err.message })
    }
  }, [])

  const reset = useCallback(() => setStage({ name: 'idle' }), [])

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-start gap-4 justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/agenda"
              className="text-[12px] text-[#9ca3af] hover:text-[#0F3D3E] flex items-center gap-1 transition-colors"
            >
              <ArrowLeft size={12} /> Agenda
            </Link>
          </div>
          <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight">
            Importar Agenda EasyJur
          </h1>
          <p className="text-[13px] text-[#7a8899] mt-0.5">
            Importe compromissos exportados do EasyJur em formato CSV
          </p>
        </div>
      </div>

      {/* ── IDLE: Drop zone ── */}
      {stage.name === 'idle' && (
        <div className="space-y-4">
          <DropZone onFile={handleFile} />

          {/* Informações sobre o mapeamento */}
          <div className="bg-[#f9fafb] rounded-2xl border border-[#e5e7eb] p-5">
            <p className="text-[12px] font-semibold text-[#6b7280] uppercase tracking-wider mb-3">
              Colunas reconhecidas automaticamente
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-[12px] text-[#4b5563]">
              {[
                ['ID / Agendamento', 'Identificador único'],
                ['Responsável', 'Vinculado ao usuário interno'],
                ['Processo', 'Vinculado ao processo cadastrado'],
                ['Tribunal / Comarca', 'Local do evento'],
                ['Tipo / Subtipo', 'Categoria do evento'],
                ['Descrição / Resolução', 'Conteúdo do evento'],
                ['Data do Evento', 'Data principal (dd/mm/yyyy)'],
                ['Data Fatal', 'Prazo limite'],
                ['Hora de Início', 'Horário (HH:mm)'],
                ['Status', 'Situação do evento'],
              ].map(([col, desc]) => (
                <div key={col} className="flex gap-1.5">
                  <span className="font-medium text-[#374151] shrink-0">{col}:</span>
                  <span className="text-[#9ca3af]">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── UPLOADING: Spinner ── */}
      {stage.name === 'uploading' && (
        <div className="flex flex-col items-center gap-4 py-20">
          <div className="w-12 h-12 rounded-full border-4 border-[#D0DCDC] border-t-[#145A5B] animate-spin" />
          <p className="text-[14px] font-medium text-[#6b7280]">Analisando o arquivo…</p>
        </div>
      )}

      {/* ── PREVIEW: Tabela + badges + botão confirmar ── */}
      {stage.name === 'preview' && (() => {
        const { result, file } = stage
        const { summary }      = result
        const hasImportable    = summary.newCount + summary.updateCount > 0

        return (
          <div className="space-y-5">
            {/* Info do arquivo */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-[#e5e7eb]">
              <FileText size={16} className="text-[#145A5B] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#1a1d23] truncate">{file.name}</p>
                <p className="text-[11px] text-[#9ca3af]">
                  {(file.size / 1024).toFixed(1)} KB &middot; {summary.total} linha{summary.total !== 1 ? 's' : ''} encontradas
                </p>
              </div>
              <button
                onClick={reset}
                className="p-1.5 rounded-lg hover:bg-[#f3f4f6] text-[#9ca3af] hover:text-[#374151] transition-colors"
                title="Trocar arquivo"
              >
                <X size={14} />
              </button>
            </div>

            {/* Badges de contagem */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Badge label="Novos"        count={summary.newCount}    color="bg-emerald-50 border-emerald-200 text-emerald-700" />
              <Badge label="Atualizações" count={summary.updateCount} color="bg-blue-50 border-blue-200 text-blue-700" />
              <Badge label="Duplicados"   count={summary.skipCount}   color="bg-zinc-50 border-zinc-200 text-zinc-500" />
              <Badge label="Com erro"     count={summary.errorCount}  color={summary.errorCount > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-zinc-50 border-zinc-200 text-zinc-400'} />
            </div>

            {/* Aviso se não houver nada a importar */}
            {!hasImportable && (
              <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-700 text-[13px]">
                <AlertCircle size={16} className="shrink-0" />
                Nenhuma linha nova ou atualizável foi encontrada. Verifique o arquivo e tente novamente.
              </div>
            )}

            {/* Tabela de preview */}
            <PreviewTable rows={result.rows} />

            {/* Mapeamento de colunas detectado */}
            {Object.keys(result.columnMapping).length > 0 && (
              <details className="group bg-[#f9fafb] rounded-xl border border-[#e5e7eb] overflow-hidden">
                <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-[12px] font-semibold text-[#6b7280] uppercase tracking-wider list-none">
                  Mapeamento de colunas detectado
                  <ChevronDown size={13} className="group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {Object.entries(result.columnMapping).map(([original, internal]) => (
                    <div key={original} className="flex items-center gap-2 text-[12px]">
                      <code className="bg-white px-2 py-0.5 rounded border border-[#e5e7eb] text-[#374151] text-[11px]">{original}</code>
                      <span className="text-[#9ca3af]">→</span>
                      <code className="text-[#145A5B] font-mono text-[11px]">{internal}</code>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Ações */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleConfirm(result, file)}
                disabled={!hasImportable}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#0F3D3E] hover:bg-[#145A5B] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold rounded-xl transition-colors"
              >
                <CheckCircle2 size={15} />
                Confirmar importação
                {hasImportable && (
                  <span className="ml-1 text-[11px] font-normal opacity-80">
                    ({summary.newCount + summary.updateCount} evento{summary.newCount + summary.updateCount !== 1 ? 's' : ''})
                  </span>
                )}
              </button>
              <button
                onClick={reset}
                className="px-4 py-2.5 text-[13px] text-[#6b7280] hover:text-[#1a1d23] transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── CONFIRMING: Spinner ── */}
      {stage.name === 'confirming' && (
        <div className="flex flex-col items-center gap-4 py-20">
          <div className="w-12 h-12 rounded-full border-4 border-[#D0DCDC] border-t-[#145A5B] animate-spin" />
          <div className="text-center">
            <p className="text-[14px] font-medium text-[#1a1d23]">Importando eventos…</p>
            <p className="text-[12px] text-[#9ca3af] mt-1">
              {stage.result.summary.newCount + stage.result.summary.updateCount} evento{stage.result.summary.newCount + stage.result.summary.updateCount !== 1 ? 's' : ''} sendo processados
            </p>
          </div>
        </div>
      )}

      {/* ── DONE: Resultado final ── */}
      {stage.name === 'done' && (
        <DoneScreen result={stage.result} filename={stage.filename} onReset={reset} />
      )}

      {/* ── ERROR: Mensagem de erro ── */}
      {stage.name === 'error' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 px-5 py-4 bg-red-50 rounded-xl border border-red-200 text-red-700">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-semibold">Erro na importação</p>
              <p className="text-[12px] mt-0.5">{stage.message}</p>
            </div>
          </div>
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#f3f4f6] hover:bg-[#e5e7eb] text-[#374151] text-[13px] font-medium rounded-xl transition-colors"
          >
            <RefreshCw size={14} /> Tentar novamente
          </button>
        </div>
      )}
    </div>
  )
}
