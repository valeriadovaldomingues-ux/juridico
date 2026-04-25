'use client'

import { useRef, useState, useCallback, useEffect, type ReactNode } from 'react'
import {
  Upload, X, CheckCircle, AlertTriangle, FileText,
  Loader2, RefreshCw, Users, Copy, Ban, ArrowRight,
  SkipForward, History, ChevronDown, ChevronRight,
} from 'lucide-react'
import { parseTrelloCsv, IMPORT_CUTOFF } from '@/lib/kanban/csv-import'
import type { ParsedCsvRow, ParsedRejected } from '@/lib/kanban/csv-import'
import type { ImportPreviewResult } from '@/app/api/kanban-tasks/import-csv/preview/route'
import type { ImportResult } from '@/app/api/kanban-tasks/import-csv/route'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Phase =
  | 'upload'
  | 'analyzing'
  | 'preview'
  | 'importing'
  | 'done'

interface ImportLog {
  id: string
  import_batch_id: string
  arquivo_nome: string
  total_linhas: number
  importados: number
  atualizados: number
  ignorados: number
  rejeitados: number
  erros: number
  created_at: string
  usuario: { nome: string } | null
}

interface Props {
  onClose:      () => void
  onImportDone: () => void | Promise<void>
}

const MAX_FILE_MB = 10
const MAX_FILE_SIZE = MAX_FILE_MB * 1024 * 1024

// ── Componente principal ───────────────────────────────────────────────────────

export default function TrelloCsvImportModal({ onClose, onImportDone }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const [phase,        setPhase]        = useState<Phase>('upload')
  const [fileName,     setFileName]     = useState<string>('')
  const [parsedRows,   setParsedRows]   = useState<ParsedCsvRow[]>([])
  const [rejected,     setRejected]     = useState<ParsedRejected[]>([])
  const [parseErrors,  setParseErrors]  = useState<string[]>([])
  const [preview,      setPreview]      = useState<ImportPreviewResult | null>(null)
  const [result,       setResult]       = useState<ImportResult | null>(null)
  const [errorMsg,     setErrorMsg]     = useState<string>('')
  const [showHistory,  setShowHistory]  = useState(false)
  const [logs,         setLogs]         = useState<ImportLog[]>([])
  const [loadingLogs,  setLoadingLogs]  = useState(false)
  const [showDetails,  setShowDetails]  = useState(false)
  const [isDragging,   setIsDragging]   = useState(false)

  // ── Histórico ──────────────────────────────────────────────────────────────

  async function loadHistory() {
    setLoadingLogs(true)
    try {
      const res = await fetch('/api/kanban-import-logs')
      if (res.ok) setLogs(await res.json())
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    if (showHistory) loadHistory()
  }, [showHistory])

  // ── Upload e parse ─────────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    setErrorMsg('')
    setParseErrors([])

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrorMsg('Tipo de arquivo inválido. Selecione um arquivo .csv')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: ${MAX_FILE_MB} MB.`)
      return
    }

    setFileName(file.name)
    setPhase('analyzing')

    try {
      const text = await file.text()
      const { rows, rejected: rej, errors } = parseTrelloCsv(text)

      if (errors.length && rows.length === 0) {
        setErrorMsg(errors[0])
        setPhase('upload')
        return
      }

      if (rows.length === 0 && rej.length === 0) {
        setErrorMsg('Nenhuma linha válida encontrada no CSV.')
        setPhase('upload')
        return
      }

      setParseErrors(errors)
      setParsedRows(rows)
      setRejected(rej)

      // Chama endpoint de preview
      const res = await fetch('/api/kanban-tasks/import-csv/preview', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rows, rejected_count: rej.length }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setErrorMsg(body.error ?? `Erro ${res.status} ao analisar CSV.`)
        setPhase('upload')
        return
      }

      setPreview(await res.json())
      setPhase('preview')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro inesperado ao processar arquivo.')
      setPhase('upload')
    }
  }, [])

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) processFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  // ── Importação ─────────────────────────────────────────────────────────────

  async function handleImport() {
    setPhase('importing')

    try {
      const import_batch_id = crypto.randomUUID()

      const res = await fetch('/api/kanban-tasks/import-csv', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          rows:            parsedRows,
          import_batch_id,
          arquivo_nome:    fileName,
          rejected_count:  rejected.length,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setErrorMsg(body.error ?? `Erro ${res.status} ao importar.`)
        setPhase('preview')
        return
      }

      const data: ImportResult = await res.json()
      setResult(data)
      setPhase('done')

      if (data.importados > 0 || data.atualizados > 0) {
        await onImportDone()
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro inesperado ao importar.')
      setPhase('preview')
    }
  }

  // ── Resetar ────────────────────────────────────────────────────────────────

  function reset() {
    setPhase('upload')
    setFileName('')
    setParsedRows([])
    setRejected([])
    setParseErrors([])
    setPreview(null)
    setResult(null)
    setErrorMsg('')
    setShowDetails(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#e5e7eb]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#145A5B]/10 rounded-xl flex items-center justify-center">
              <Upload size={16} className="text-[#145A5B]" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0f1923]">Importar CSV do Trello</h2>
              <p className="text-[11px] text-[#9ca3af]">
                Apenas atividades a partir de {formatDate(IMPORT_CUTOFF)} serão importadas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[#6b7280] hover:text-[#374151] hover:bg-[#f9fafb] rounded-lg transition-colors"
            >
              <History size={12} />
              Histórico
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-[#9ca3af] hover:text-[#374151] hover:bg-[#f9fafb] rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Histórico de importações */}
        {showHistory && (
          <div className="border-b border-[#e5e7eb] bg-[#f9fafb] px-6 py-4 max-h-56 overflow-y-auto">
            <p className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide mb-3">
              Últimas importações
            </p>
            {loadingLogs ? (
              <div className="flex items-center gap-2 text-[12px] text-[#9ca3af]">
                <Loader2 size={12} className="animate-spin" /> Carregando…
              </div>
            ) : logs.length === 0 ? (
              <p className="text-[12px] text-[#9ca3af]">Nenhuma importação registrada.</p>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="flex items-center justify-between text-[11px] py-1.5 border-b border-[#f3f4f6] last:border-0">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-medium text-[#374151] truncate">{log.arquivo_nome}</span>
                      <span className="text-[#9ca3af]">
                        {log.usuario?.nome ?? 'Usuário'} · {new Date(log.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      {log.importados > 0 && <LogBadge color="text-emerald-600" label={`+${log.importados}`} />}
                      {log.atualizados > 0 && <LogBadge color="text-blue-600" label={`↑${log.atualizados}`} />}
                      {log.ignorados > 0 && <LogBadge color="text-amber-600" label={`=${log.ignorados}`} />}
                      {log.rejeitados > 0 && <LogBadge color="text-[#9ca3af]" label={`✕${log.rejeitados}`} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Fase: Upload ──────────────────────────────────────── */}
          {(phase === 'upload') && (
            <div className="p-6 space-y-4">
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors
                  ${isDragging
                    ? 'border-[#145A5B] bg-[#145A5B]/5'
                    : 'border-[#e5e7eb] hover:border-[#145A5B]/40 hover:bg-[#f9fafb]'}
                `}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? 'bg-[#145A5B]/15' : 'bg-[#f3f4f6]'}`}>
                    <FileText size={22} className={isDragging ? 'text-[#145A5B]' : 'text-[#9ca3af]'} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#374151]">
                      {isDragging ? 'Solte o arquivo aqui' : 'Arraste o CSV ou clique para selecionar'}
                    </p>
                    <p className="text-[11px] text-[#9ca3af] mt-1">
                      Exportação do Trello · máx. {MAX_FILE_MB} MB
                    </p>
                  </div>
                </div>
              </div>

              <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFileInput} />

              {errorMsg && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl">
                  <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-red-700 leading-relaxed">{errorMsg}</p>
                </div>
              )}

              <div className="bg-[#f9fafb] rounded-xl p-4 space-y-2">
                <p className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide">Como exportar do Trello</p>
                <ol className="space-y-1.5 text-[12px] text-[#6b7280]">
                  <li className="flex items-start gap-2"><span className="font-bold text-[#145A5B]">1</span>Abra o quadro no Trello</li>
                  <li className="flex items-start gap-2"><span className="font-bold text-[#145A5B]">2</span>Menu ··· → Imprimir e exportar → Exportar como JSON ou CSV</li>
                  <li className="flex items-start gap-2"><span className="font-bold text-[#145A5B]">3</span>Selecione o arquivo CSV baixado aqui</li>
                </ol>
              </div>
            </div>
          )}

          {/* ── Fase: Analisando ──────────────────────────────────── */}
          {phase === 'analyzing' && (
            <div className="p-6 flex flex-col items-center gap-4 py-16">
              <div className="w-14 h-14 bg-[#145A5B]/10 rounded-2xl flex items-center justify-center">
                <Loader2 size={24} className="text-[#145A5B] animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-[14px] font-semibold text-[#0f1923]">Analisando CSV…</p>
                <p className="text-[12px] text-[#9ca3af] mt-1">{fileName}</p>
              </div>
            </div>
          )}

          {/* ── Fase: Preview ─────────────────────────────────────── */}
          {phase === 'preview' && preview && (
            <div className="p-6 space-y-5">
              {/* Arquivo selecionado */}
              <div className="flex items-center gap-2.5 p-3 bg-[#f9fafb] rounded-xl border border-[#e5e7eb]">
                <FileText size={14} className="text-[#9ca3af] shrink-0" />
                <span className="text-[12px] text-[#374151] font-medium truncate flex-1">{fileName}</span>
                <button onClick={reset} className="text-[11px] text-[#9ca3af] hover:text-[#374151] shrink-0 transition-colors">
                  Trocar
                </button>
              </div>

              {/* Cards de resumo */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard
                  icon={<FileText size={14} />}
                  label="Total no CSV"
                  value={preview.total_csv + preview.rejeitados}
                  color="text-[#374151]"
                  bg="bg-[#f9fafb]"
                />
                <StatCard
                  icon={<CheckCircle size={14} />}
                  label="Novas tarefas"
                  value={preview.novas}
                  color="text-emerald-600"
                  bg="bg-emerald-50"
                />
                <StatCard
                  icon={<RefreshCw size={14} />}
                  label="Atualizações"
                  value={preview.atualizacoes}
                  color="text-blue-600"
                  bg="bg-blue-50"
                />
                <StatCard
                  icon={<Copy size={14} />}
                  label="Duplicatas"
                  value={preview.duplicatas}
                  color="text-amber-600"
                  bg="bg-amber-50"
                />
                <StatCard
                  icon={<Users size={14} />}
                  label="Sem responsável"
                  value={preview.sem_responsavel}
                  color="text-orange-600"
                  bg="bg-orange-50"
                />
                <StatCard
                  icon={<Ban size={14} />}
                  label="Rejeitadas"
                  value={preview.rejeitados}
                  color="text-[#9ca3af]"
                  bg="bg-[#f3f4f6]"
                />
              </div>

              {/* Alertas informativos */}
              {preview.sem_responsavel > 0 && preview.sem_responsavel_nomes.length > 0 && (
                <InfoBox icon={<Users size={13} />} color="orange">
                  <span className="font-semibold">{preview.sem_responsavel} {plural(preview.sem_responsavel, 'tarefa', 'tarefas')}</span> sem responsável reconhecido.
                  Serão importadas sem atribuição.{' '}
                  <span className="text-orange-500">({preview.sem_responsavel_nomes.slice(0, 3).join(', ')}{preview.sem_responsavel_nomes.length > 3 ? ` +${preview.sem_responsavel_nomes.length - 3}` : ''})</span>
                </InfoBox>
              )}

              {preview.rejeitados > 0 && (
                <InfoBox icon={<SkipForward size={13} />} color="gray">
                  <span className="font-semibold">{preview.rejeitados} {plural(preview.rejeitados, 'card', 'cards')}</span> ignorados — última atividade anterior a {formatDate(IMPORT_CUTOFF)}.
                </InfoBox>
              )}

              {parseErrors.length > 0 && (
                <InfoBox icon={<AlertTriangle size={13} />} color="red">
                  {parseErrors.length} {plural(parseErrors.length, 'linha ignorada', 'linhas ignoradas')} por erro de formato.
                </InfoBox>
              )}

              {/* Detalhes das rejeitadas */}
              {rejected.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowDetails(v => !v)}
                    className="flex items-center gap-1.5 text-[11px] text-[#9ca3af] hover:text-[#374151] transition-colors"
                  >
                    {showDetails ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    Ver cards rejeitados ({rejected.length})
                  </button>
                  {showDetails && (
                    <div className="mt-2 max-h-32 overflow-y-auto bg-[#f9fafb] rounded-xl p-3 space-y-1">
                      {rejected.map((r, i) => (
                        <div key={i} className="text-[11px] text-[#9ca3af] truncate">
                          <span className="text-[#6b7280]">{r.titulo}</span>
                          {r.last_activity && <span> — {r.last_activity}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Perfis disponíveis */}
              {preview.perfis_disponiveis.length > 0 && (
                <div className="text-[11px] text-[#9ca3af]">
                  Responsáveis reconhecidos: {preview.perfis_disponiveis.join(', ')}
                </div>
              )}

              {errorMsg && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl">
                  <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-red-700 leading-relaxed">{errorMsg}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Fase: Importando ──────────────────────────────────── */}
          {phase === 'importing' && (
            <div className="p-6 flex flex-col items-center gap-4 py-16">
              <div className="w-14 h-14 bg-[#145A5B]/10 rounded-2xl flex items-center justify-center">
                <Loader2 size={24} className="text-[#145A5B] animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-[14px] font-semibold text-[#0f1923]">Importando…</p>
                <p className="text-[12px] text-[#9ca3af] mt-1">
                  {(preview?.novas ?? 0) + (preview?.atualizacoes ?? 0)} tarefas sendo processadas
                </p>
              </div>
            </div>
          )}

          {/* ── Fase: Concluído ───────────────────────────────────── */}
          {phase === 'done' && result && (
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <CheckCircle size={20} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-[#0f1923]">Importação concluída</p>
                  <p className="text-[11px] text-[#9ca3af]">Batch: {result.import_batch_id.slice(0, 8)}…</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={<CheckCircle size={14} />} label="Importadas" value={result.importados} color="text-emerald-600" bg="bg-emerald-50" />
                <StatCard icon={<RefreshCw size={14} />} label="Atualizadas" value={result.atualizados} color="text-blue-600" bg="bg-blue-50" />
                <StatCard icon={<Copy size={14} />} label="Ignoradas" value={result.ignorados} color="text-amber-600" bg="bg-amber-50" />
                <StatCard icon={<AlertTriangle size={14} />} label="Erros" value={result.erros} color="text-red-600" bg="bg-red-50" />
              </div>

              {result.importados === 0 && result.atualizados === 0 && (
                <InfoBox icon={<FileText size={13} />} color="gray">
                  Nenhuma tarefa nova — todas já existem no sistema.
                </InfoBox>
              )}

              {result.detalhes.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowDetails(v => !v)}
                    className="flex items-center gap-1.5 text-[11px] text-[#9ca3af] hover:text-[#374151] transition-colors"
                  >
                    {showDetails ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    Ver detalhes ({result.detalhes.length})
                  </button>
                  {showDetails && (
                    <ul className="mt-2 max-h-32 overflow-y-auto bg-[#f9fafb] rounded-xl p-3 space-y-1">
                      {result.detalhes.map((d, i) => (
                        <li key={i} className="text-[11px] text-[#9ca3af] leading-relaxed">{d}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#e5e7eb] flex items-center justify-between gap-3">
          {phase === 'upload' && (
            <>
              <span />
              <button
                onClick={onClose}
                className="px-4 py-2 text-[13px] text-[#6b7280] hover:text-[#374151] transition-colors"
              >
                Cancelar
              </button>
            </>
          )}

          {phase === 'preview' && preview && (
            <>
              <button
                onClick={reset}
                className="px-4 py-2 text-[13px] text-[#6b7280] hover:text-[#374151] transition-colors flex items-center gap-1.5"
              >
                ← Trocar arquivo
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-[13px] text-[#6b7280] hover:text-[#374151] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImport}
                  disabled={preview.novas + preview.atualizacoes === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#145A5B] hover:bg-[#0f4243] text-white text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  <ArrowRight size={14} />
                  Importar agora ({preview.novas + preview.atualizacoes})
                </button>
              </div>
            </>
          )}

          {phase === 'done' && (
            <>
              <button
                onClick={reset}
                className="flex items-center gap-1.5 px-4 py-2 text-[13px] text-[#6b7280] hover:text-[#374151] transition-colors"
              >
                <Upload size={13} />
                Nova importação
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-[#145A5B] hover:bg-[#0f4243] text-white text-[13px] font-semibold rounded-xl transition-colors shadow-sm"
              >
                Fechar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, color, bg,
}: {
  icon: ReactNode
  label: string
  value: number
  color: string
  bg: string
}) {
  return (
    <div className={`${bg} rounded-xl p-3.5 flex flex-col gap-1.5`}>
      <div className={`${color} flex items-center gap-1.5 text-[11px] font-semibold`}>
        {icon}
        <span>{label}</span>
      </div>
      <p className={`text-[22px] font-bold ${color} leading-none tabular-nums`}>{value}</p>
    </div>
  )
}

function InfoBox({
  icon, color, children,
}: {
  icon: ReactNode
  color: 'orange' | 'gray' | 'red'
  children: ReactNode
}) {
  const styles = {
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    gray:   'bg-[#f9fafb] border-[#e5e7eb] text-[#6b7280]',
    red:    'bg-red-50 border-red-200 text-red-700',
  }
  return (
    <div className={`flex items-start gap-2.5 p-3.5 border rounded-xl text-[12px] leading-relaxed ${styles[color]}`}>
      <span className="shrink-0 mt-0.5">{icon}</span>
      <span>{children}</span>
    </div>
  )
}

function LogBadge({ color, label }: { color: string; label: string }) {
  return <span className={`font-bold tabular-nums ${color}`}>{label}</span>
}

// ── Utils ──────────────────────────────────────────────────────────────────────

function plural(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
