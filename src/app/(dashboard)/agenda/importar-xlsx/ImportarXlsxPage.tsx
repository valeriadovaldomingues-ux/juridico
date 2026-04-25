'use client'

// ─────────────────────────────────────────────────────────────────────────────
// ImportarXlsxPage.tsx
//
// Importador de agenda EasyJur via arquivo .xlsx.
// Fluxo: idle → uploading → preview → confirming → done (ou error)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react'
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle,
  RefreshCw, ChevronDown, ChevronUp, Download, X, ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import type { XlsxPreviewResult, XlsxConfirmResult, XlsxPreviewRow } from '@/types/xlsx-import'

// ─── Máquina de estados ───────────────────────────────────────────────────────

type Stage =
  | { name: 'idle' }
  | { name: 'uploading' }
  | { name: 'preview';    result: XlsxPreviewResult; file: File }
  | { name: 'confirming'; result: XlsxPreviewResult; file: File }
  | { name: 'done';       result: XlsxConfirmResult; filename: string }
  | { name: 'error';      message: string }

// ─── Estilos por status de linha ─────────────────────────────────────────────

const ROW_STATUS_CFG = {
  new:       { label: 'Novo',        bg: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60', dot: 'bg-emerald-500' },
  update:    { label: 'Atualização', bg: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/60',           dot: 'bg-blue-500'     },
  duplicate: { label: 'Duplicado',   bg: 'bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200/60',          dot: 'bg-zinc-400'    },
  error:     { label: 'Erro',        bg: 'bg-red-50 text-red-700 ring-1 ring-red-200/60',               dot: 'bg-red-500'     },
} as const

const EVENT_TYPE_LABEL: Record<string, string> = {
  AUDIENCIA:   'Audiência',
  PRAZO:       'Prazo',
  PERICIA:     'Perícia',
  TAREFA:      'Tarefa',
  CONSULTORIA: 'Consultoria',
}

// ─── Download de erros ────────────────────────────────────────────────────────

function downloadErrorsCsv(result: XlsxConfirmResult, filename: string) {
  if (result.errorRows.length === 0) return
  const allKeys = [...new Set(result.errorRows.flatMap(r => Object.keys(r.raw)))]
  const headers = ['Linha', 'Erro', ...allKeys]
  const lines   = [
    headers.join(';'),
    ...result.errorRows.map(r => [
      r.rowNumber,
      `"${(r.error ?? '').replace(/"/g, '""')}"`,
      ...allKeys.map(k => `"${(r.raw[k] ?? '').replace(/"/g, '""')}"`),
    ].join(';')),
  ]
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `erros_${filename.replace('.xlsx','')}_${Date.now()}.csv`,
  })
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

function RowBadge({ status }: { status: XlsxPreviewRow['rowStatus'] }) {
  const { label, bg, dot } = ROW_STATUS_CFG[status]
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      {label}
    </span>
  )
}

// ─── Zona de drop ─────────────────────────────────────────────────────────────

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
      <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={handleChange} />

      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${dragging ? 'bg-[#145A5B]' : 'bg-[#f3f4f6]'}`}>
        <FileSpreadsheet size={26} className={dragging ? 'text-white' : 'text-[#9ca3af]'} />
      </div>

      <div className="text-center space-y-1">
        <p className="text-[15px] font-semibold text-[#1a1d23]">
          {dragging ? 'Solte o arquivo aqui' : 'Arraste o Excel do EasyJur'}
        </p>
        <p className="text-[13px] text-[#9ca3af]">
          ou clique para selecionar &middot; Apenas <strong>.xlsx</strong>
        </p>
      </div>

      <div className="flex items-center gap-6 text-[11px] text-[#9ca3af] mt-2">
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Audiências</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Prazos</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> Tarefas</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Perícias</span>
      </div>
    </div>
  )
}

// ─── Tabela de preview ────────────────────────────────────────────────────────

function PreviewTable({ rows }: { rows: XlsxPreviewRow[] }) {
  const [showAll, setShowAll] = useState(false)
  const [filter, setFilter]   = useState<XlsxPreviewRow['rowStatus'] | 'all'>('all')

  const filtered  = filter === 'all' ? rows : rows.filter(r => r.rowStatus === filter)
  const displayed = showAll ? filtered : filtered.slice(0, 20)

  function fmt(iso: string | null): string {
    if (!iso) return '—'
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'new', 'update', 'duplicate', 'error'] as const).map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setShowAll(false) }}
            className={`text-[11px] font-semibold px-3 py-1 rounded-full transition-colors ${
              filter === f ? 'bg-[#0F3D3E] text-white' : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'
            }`}
          >
            {f === 'all'
              ? `Todos (${rows.length})`
              : `${ROW_STATUS_CFG[f].label} (${rows.filter(r => r.rowStatus === f).length})`
            }
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-[#e5e7eb] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#f9fafb] border-b border-[#f3f4f6]">
                {['#', 'Status', 'Tipo', 'Data', 'Responsável 1', 'Cliente', 'Processo', 'Tribunal', 'Título / Erro'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-[#9ca3af] uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f9fafb]">
              {displayed.map(row => (
                <tr
                  key={row.rowNumber}
                  className={`transition-colors ${row.rowStatus === 'error' ? 'bg-red-50/40' : 'hover:bg-[#fafafa]'}`}
                >
                  <td className="px-3 py-2.5 text-[#9ca3af] font-mono text-[11px]">{row.rowNumber}</td>
                  <td className="px-3 py-2.5"><RowBadge status={row.rowStatus} /></td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {row.event_type
                      ? <span className="text-[11px] font-medium text-[#374151]">{EVENT_TYPE_LABEL[row.event_type] ?? row.event_type}</span>
                      : <span className="text-[#d1d5db]">—</span>
                    }
                  </td>
                  <td className="px-3 py-2.5 text-[#374151] whitespace-nowrap">{fmt(row.event_date)}</td>
                  <td className="px-3 py-2.5 text-[#374151] max-w-[140px] truncate text-[11px]">{row.owner_name ?? '—'}</td>
                  <td className="px-3 py-2.5 text-[#374151] max-w-[160px] truncate text-[11px]">{row.client_name ?? '—'}</td>
                  <td className="px-3 py-2.5 text-[#374151] font-mono text-[10px] whitespace-nowrap">{row.process_number ?? '—'}</td>
                  <td className="px-3 py-2.5 text-[#374151] text-[11px]">{row.court ?? '—'}</td>
                  <td className="px-3 py-2.5 max-w-[240px]">
                    {row.rowStatus === 'error'
                      ? <span className="text-red-600 text-[11px]">{row.errorMessage}</span>
                      : <span className="text-[#1a1d23] text-[11px] line-clamp-1">{row.title}</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length > 20 && (
          <button
            onClick={() => setShowAll(v => !v)}
            className="w-full flex items-center justify-center gap-1.5 py-3 text-[12px] text-[#6b7280] hover:text-[#0F3D3E] hover:bg-[#f9fafb] border-t border-[#f3f4f6] transition-colors"
          >
            {showAll
              ? <><ChevronUp size={13} /> Mostrar menos</>
              : <><ChevronDown size={13} /> Ver todas as {filtered.length} linhas</>
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

// ─── Tela de resultado final ──────────────────────────────────────────────────

function DoneScreen({ result, filename, onReset }: {
  result: XlsxConfirmResult; filename: string; onReset: () => void
}) {
  const hasErrors = result.errors > 0
  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Badge label="Criados"     count={result.created} color="bg-emerald-50 border-emerald-200 text-emerald-700" />
        <Badge label="Atualizados" count={result.updated} color="bg-blue-50 border-blue-200 text-blue-700" />
        <Badge label="Ignorados"   count={result.skipped} color="bg-zinc-50 border-zinc-200 text-zinc-500" />
        <Badge label="Com erro"    count={result.errors}  color={result.errors > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-zinc-50 border-zinc-200 text-zinc-400'} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {hasErrors && (
          <button
            onClick={() => downloadErrorsCsv(result, filename)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 text-[13px] font-medium rounded-xl border border-red-200 transition-colors"
          >
            <Download size={14} /> Baixar erros ({result.errors})
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

export default function ImportarXlsxPage() {
  const [stage, setStage] = useState<Stage>({ name: 'idle' })

  const handleFile = useCallback(async (file: File) => {
    setStage({ name: 'uploading' })
    const form = new FormData()
    form.append('file', file)
    try {
      const res  = await fetch('/api/agenda-import-xlsx/preview', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) { setStage({ name: 'error', message: json.error ?? 'Erro ao processar o arquivo' }); return }
      setStage({ name: 'preview', result: json as XlsxPreviewResult, file })
    } catch (err: any) {
      setStage({ name: 'error', message: 'Erro de rede: ' + err.message })
    }
  }, [])

  const handleConfirm = useCallback(async (result: XlsxPreviewResult, file: File) => {
    setStage({ name: 'confirming', result, file })
    const form = new FormData()
    form.append('file', file)
    try {
      const res  = await fetch('/api/agenda-import-xlsx/confirm', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) { setStage({ name: 'error', message: json.error ?? 'Erro durante a importação' }); return }
      setStage({ name: 'done', result: json as XlsxConfirmResult, filename: file.name })
    } catch (err: any) {
      setStage({ name: 'error', message: 'Erro de rede: ' + err.message })
    }
  }, [])

  const reset = useCallback(() => setStage({ name: 'idle' }), [])

  return (
    <div className="max-w-5xl space-y-6">

      {/* Cabeçalho */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/agenda" className="text-[12px] text-[#9ca3af] hover:text-[#0F3D3E] flex items-center gap-1 transition-colors">
            <ArrowLeft size={12} /> Agenda
          </Link>
        </div>
        <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight">
          Importar Agenda EasyJur
        </h1>
        <p className="text-[13px] text-[#7a8899] mt-0.5">
          Importação via arquivo Excel (.xlsx) exportado do EasyJur
        </p>
      </div>

      {/* ── IDLE ── */}
      {stage.name === 'idle' && (
        <div className="space-y-4">
          <DropZone onFile={handleFile} />

          <div className="bg-[#f9fafb] rounded-2xl border border-[#e5e7eb] p-5">
            <p className="text-[12px] font-semibold text-[#6b7280] uppercase tracking-wider mb-3">
              Campos importados automaticamente
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-1.5 text-[12px]">
              {[
                ['ID EasyJur', 'Identificador único para dedup'],
                ['Tipo de Evento', 'Audiência, Prazo, Tarefa…'],
                ['Responsável', 'Advogada titular e secundária'],
                ['Cliente / Contrário', 'Partes do processo'],
                ['Data do Evento', 'Data interna + prazo fatal'],
                ['Hora de Início', 'Normalizada para HH:mm:ss'],
                ['Descrição', 'Texto completo da publicação'],
                ['Número do Processo', 'Formato CNJ (sem aspas)'],
                ['Tribunal / Comarca', 'TRT + UF + Vara'],
                ['Valor da Causa', 'Em reais, preservado'],
                ['Área do Direito', 'Trabalhista, Cível…'],
                ['Status do Processo', 'Ativo, Encerrado…'],
              ].map(([campo, desc]) => (
                <div key={campo} className="flex gap-1.5">
                  <span className="font-medium text-[#374151] shrink-0">{campo}:</span>
                  <span className="text-[#9ca3af]">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── UPLOADING ── */}
      {stage.name === 'uploading' && (
        <div className="flex flex-col items-center gap-4 py-20">
          <div className="w-12 h-12 rounded-full border-4 border-[#D0DCDC] border-t-[#145A5B] animate-spin" />
          <p className="text-[14px] font-medium text-[#6b7280]">Lendo planilha…</p>
        </div>
      )}

      {/* ── PREVIEW ── */}
      {stage.name === 'preview' && (() => {
        const { result, file } = stage
        const { summary }      = result
        const importable       = summary.newCount + summary.updateCount

        return (
          <div className="space-y-5">
            {/* Arquivo + tipo detectado */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-[#e5e7eb]">
              <FileSpreadsheet size={16} className="text-[#145A5B] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#1a1d23] truncate">{file.name}</p>
                <p className="text-[11px] text-[#9ca3af]">
                  {(file.size / 1024).toFixed(1)} KB &middot; {summary.total} linha{summary.total !== 1 ? 's' : ''} &middot;
                  <span className="ml-1 text-[#145A5B] font-medium">{result.detectedType}</span>
                </p>
              </div>
              <button onClick={reset} className="p-1.5 rounded-lg hover:bg-[#f3f4f6] text-[#9ca3af] hover:text-[#374151] transition-colors"><X size={14} /></button>
            </div>

            {/* Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Badge label="Novos"        count={summary.newCount}    color="bg-emerald-50 border-emerald-200 text-emerald-700" />
              <Badge label="Atualizações" count={summary.updateCount} color="bg-blue-50 border-blue-200 text-blue-700" />
              <Badge label="Duplicados"   count={summary.skipCount}   color="bg-zinc-50 border-zinc-200 text-zinc-500" />
              <Badge label="Com erro"     count={summary.errorCount}  color={summary.errorCount > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-zinc-50 border-zinc-200 text-zinc-400'} />
            </div>

            {!importable && (
              <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-700 text-[13px]">
                <AlertCircle size={16} className="shrink-0" />
                Nenhuma linha nova ou atualizável. Verifique o arquivo.
              </div>
            )}

            <PreviewTable rows={result.rows} />

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleConfirm(result, file)}
                disabled={!importable}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#0F3D3E] hover:bg-[#145A5B] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold rounded-xl transition-colors"
              >
                <CheckCircle2 size={15} />
                Confirmar importação
                {importable > 0 && (
                  <span className="ml-1 text-[11px] font-normal opacity-80">
                    ({importable} evento{importable !== 1 ? 's' : ''})
                  </span>
                )}
              </button>
              <button onClick={reset} className="px-4 py-2.5 text-[13px] text-[#6b7280] hover:text-[#1a1d23] transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── CONFIRMING ── */}
      {stage.name === 'confirming' && (
        <div className="flex flex-col items-center gap-4 py-20">
          <div className="w-12 h-12 rounded-full border-4 border-[#D0DCDC] border-t-[#145A5B] animate-spin" />
          <div className="text-center">
            <p className="text-[14px] font-medium text-[#1a1d23]">Importando eventos…</p>
            <p className="text-[12px] text-[#9ca3af] mt-1">
              {stage.result.summary.newCount + stage.result.summary.updateCount} eventos sendo gravados
            </p>
          </div>
        </div>
      )}

      {/* ── DONE ── */}
      {stage.name === 'done' && (
        <DoneScreen result={stage.result} filename={stage.filename} onReset={reset} />
      )}

      {/* ── ERROR ── */}
      {stage.name === 'error' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 px-5 py-4 bg-red-50 rounded-xl border border-red-200 text-red-700">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-semibold">Erro na importação</p>
              <p className="text-[12px] mt-0.5">{stage.message}</p>
            </div>
          </div>
          <button onClick={reset} className="flex items-center gap-2 px-5 py-2.5 bg-[#f3f4f6] hover:bg-[#e5e7eb] text-[#374151] text-[13px] font-medium rounded-xl transition-colors">
            <RefreshCw size={14} /> Tentar novamente
          </button>
        </div>
      )}
    </div>
  )
}
