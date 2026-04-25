'use client'

import { useRef, useState } from 'react'
import { Upload, X, CheckCircle, AlertTriangle, FileText, Loader2 } from 'lucide-react'
import { parseTrelloCsv } from '@/lib/kanban/csv-import'

const MAX_FILE_SIZE = 5 * 1024 * 1024   // 5 MB

interface ImportResult {
  importados: number
  ignorados:  number
  erros:      number
  detalhes:   string[]
}

type Status = 'idle' | 'loading' | 'success' | 'error'

interface Props {
  /** Chamado após importação bem-sucedida para recarregar o board */
  onImportDone: () => void | Promise<void>
}

export default function CsvImportButton({ onImportDone }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status,  setStatus]  = useState<Status>('idle')
  const [result,  setResult]  = useState<ImportResult | null>(null)
  const [message, setMessage] = useState<string>('')

  function handleClick() {
    inputRef.current?.click()
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset input para permitir re-seleção do mesmo arquivo
    e.target.value = ''

    if (!file) return

    // ── Validações básicas ──────────────────────────────────────────────────
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setStatus('error')
      setMessage('Tipo de arquivo inválido. Selecione um arquivo .csv')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setStatus('error')
      setMessage(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: 5 MB.`)
      return
    }

    setStatus('loading')
    setResult(null)
    setMessage('')

    try {
      // ── Leitura e parsing do CSV no browser ────────────────────────────────
      const text = await file.text()
      const { rows, errors: parseErrors } = parseTrelloCsv(text)

      if (parseErrors.length && rows.length === 0) {
        // Erro fatal de parsing (ex: sem coluna de título)
        setStatus('error')
        setMessage(parseErrors[0])
        return
      }

      if (rows.length === 0) {
        setStatus('error')
        setMessage('Nenhuma linha válida encontrada no CSV.')
        return
      }

      // ── POST para a API ─────────────────────────────────────────────────────
      const res = await fetch('/api/kanban-tasks/import-csv', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rows }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setStatus('error')
        setMessage(body.error ?? `Erro ${res.status} ao importar.`)
        return
      }

      const data: ImportResult = await res.json()
      setResult(data)
      setStatus('success')

      // Recarrega o board se pelo menos uma tarefa foi importada
      if (data.importados > 0) {
        await onImportDone()
      }
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Erro inesperado ao processar o arquivo.')
    }
  }

  function dismiss() {
    setStatus('idle')
    setResult(null)
    setMessage('')
  }

  return (
    <div className="relative">
      {/* Input oculto */}
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFile}
      />

      {/* Botão principal */}
      <button
        onClick={handleClick}
        disabled={status === 'loading'}
        className="flex items-center gap-2 px-4 py-2.5 border border-[#e5e7eb] bg-white hover:bg-[#f9fafb] text-[#374151] text-[12px] font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        title="Importar tarefas a partir de CSV exportado do Trello"
      >
        {status === 'loading' ? (
          <Loader2 size={13} className="animate-spin text-[#145A5B]" />
        ) : (
          <Upload size={13} className="text-[#7a8899]" />
        )}
        {status === 'loading' ? 'Importando…' : 'Importar CSV Trello'}
      </button>

      {/* Banner de resultado — aparece abaixo do botão */}
      {status !== 'idle' && status !== 'loading' && (
        <div className={`
          absolute top-full right-0 mt-2 w-80 rounded-xl border shadow-lg z-50 p-4
          ${status === 'success' ? 'bg-white border-[#e5e7eb]' : 'bg-red-50 border-red-200'}
        `}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              {status === 'success' ? (
                <CheckCircle size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              )}

              <div className="flex-1 min-w-0">
                {status === 'success' && result ? (
                  <>
                    <p className="text-[13px] font-semibold text-[#0f1923]">
                      Importação concluída
                    </p>
                    <div className="mt-2 space-y-1">
                      <ResultLine
                        icon="✓"
                        color="text-emerald-600"
                        label="Importadas"
                        value={result.importados}
                      />
                      {result.ignorados > 0 && (
                        <ResultLine
                          icon="–"
                          color="text-amber-600"
                          label="Ignoradas (duplicatas)"
                          value={result.ignorados}
                        />
                      )}
                      {result.erros > 0 && (
                        <ResultLine
                          icon="✕"
                          color="text-red-600"
                          label="Com erro"
                          value={result.erros}
                        />
                      )}
                    </div>
                    {result.detalhes.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-[11px] text-[#7a8899] cursor-pointer hover:text-[#374151] select-none">
                          Ver detalhes ({result.detalhes.length})
                        </summary>
                        <ul className="mt-1.5 space-y-1 max-h-32 overflow-y-auto">
                          {result.detalhes.map((d, i) => (
                            <li key={i} className="text-[11px] text-[#9ca3af] leading-relaxed">
                              {d}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-[13px] font-semibold text-red-800">Erro na importação</p>
                    <p className="text-[12px] text-red-600 mt-1 leading-relaxed">{message}</p>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={dismiss}
              className="text-[#9ca3af] hover:text-[#374151] flex-shrink-0 mt-0.5 transition-colors"
              title="Fechar"
            >
              <X size={14} />
            </button>
          </div>

          {status === 'success' && result?.importados === 0 && (
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#7a8899]">
              <FileText size={11} />
              <span>Nenhuma tarefa nova — todas já existem no sistema.</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResultLine({
  icon, color, label, value,
}: {
  icon: string
  color: string
  label: string
  value: number
}) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="flex items-center gap-1.5 text-[#6b7280]">
        <span className={`font-bold ${color} w-3 text-center`}>{icon}</span>
        {label}
      </span>
      <span className={`font-bold ${color} tabular-nums`}>{value}</span>
    </div>
  )
}
