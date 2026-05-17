'use client'

import { useState, useRef, useCallback } from 'react'
import Papa from 'papaparse'
import {
  Upload, CheckCircle2, AlertCircle, AlertTriangle,
  Loader2, RotateCcw, FileText, Users, Scale, X,
  ChevronRight, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CsvRow {
  card_id:                 string
  titulo_original:         string
  numero_processo:         string
  cliente_parte_principal: string
  parte_contraria:         string
  ultimo_andamento:        string
  descricao_limpa:         string
  responsavel_principal:   string
  lista_origem:            string
  status_normalizado:      string
  area_normalizada:        string
  tribunal_inferido:       string
  urgencia:                string
  data_referencia:         string
  data_vencimento:         string
  arquivado:               string
  [key: string]: string
}

interface LogEntry {
  linha:     number
  card_id:   string
  tipo:      'ok' | 'aviso' | 'erro'
  mensagem:  string
  task_id?:  string
}

interface Relatorio {
  batch_id:              string
  total:                 number
  processos_criados:     number
  processos_atualizados: number
  processos_existentes:  number
  tarefas_criadas:       number
  tarefas_atualizadas:   number
  sem_responsavel:       number
  sem_numero:            number
  rejeitados:            number
  tabelas_afetadas:      string[]
  log:                   LogEntry[]
}

// ─── Helper: normaliza cabeçalho do CSV ──────────────────────────────────────

function normHeader(h: string): string {
  return h.replace(/^\uFEFF/, '').trim()
}

// ─── Componente ───────────────────────────────────────────────────────────────

type Etapa = 'upload' | 'preview' | 'importando' | 'resultado'

export default function CsvJuridicoImporter() {
  const [etapa,       setEtapa]       = useState<Etapa>('upload')
  const [rows,        setRows]        = useState<CsvRow[]>([])
  const [relatorio,   setRelatorio]   = useState<Relatorio | null>(null)
  const [erroArquivo, setErroArquivo] = useState('')
  const [dragging,    setDragging]    = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Estatísticas de preview ──────────────────────────────────────────────

  const stats = {
    total:         rows.length,
    comResponsavel: rows.filter(r => r.responsavel_principal?.trim()).length,
    semResponsavel: rows.filter(r => !r.responsavel_principal?.trim()).length,
    comNumero:     rows.filter(r => r.numero_processo?.trim()).length,
    semNumero:     rows.filter(r => !r.numero_processo?.trim()).length,
    ativos:        rows.filter(r => r.arquivado?.toLowerCase() !== 'true' && !r.status_normalizado?.toLowerCase().includes('conclu')).length,
    encerrados:    rows.filter(r => r.arquivado?.toLowerCase() === 'true' || r.status_normalizado?.toLowerCase().includes('conclu')).length,
    comParteContraria: rows.filter(r => r.parte_contraria?.trim()).length,
  }

  // ── Parse do arquivo ─────────────────────────────────────────────────────

  function processarArquivo(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErroArquivo('Use um arquivo .csv no formato padronizado.')
      return
    }
    setErroArquivo('')

    Papa.parse<CsvRow>(file, {
      header:          true,
      skipEmptyLines:  true,
      encoding:        'UTF-8',
      transformHeader: normHeader,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          setErroArquivo('Arquivo vazio ou sem dados.')
          return
        }
        // Valida que as colunas esperadas estão presentes
        const keys = Object.keys(results.data[0] ?? {})
        const required = ['card_id', 'responsavel_principal', 'numero_processo']
        const missing  = required.filter(k => !keys.includes(k))
        if (missing.length > 0) {
          setErroArquivo(`Colunas obrigatórias ausentes: ${missing.join(', ')}. Verifique se é o CSV padronizado correto.`)
          return
        }
        setRows(results.data)
        setEtapa('preview')
      },
      error: (err: Error) => {
        setErroArquivo(`Erro ao processar o arquivo: ${err.message}`)
      },
    })
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) processarArquivo(f)
  }, [])

  function resetar() {
    setRows([])
    setRelatorio(null)
    setEtapa('upload')
    setErroArquivo('')
  }

  // ── Importação ────────────────────────────────────────────────────────────

  async function confirmar() {
    setEtapa('importando')
    try {
      const res = await fetch('/api/importar/csv-juridico', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rows }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        setErroArquivo(err.error ?? `Erro ${res.status}`)
        setEtapa('preview')
        return
      }
      const data: Relatorio = await res.json()
      setRelatorio(data)
      setEtapa('resultado')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setErroArquivo(`Erro de conexão: ${msg}`)
      setEtapa('preview')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1a1d23]">Importar CSV Jurídico</h1>
          <p className="text-sm text-[#6b7280] mt-0.5">
            Importa o arquivo CSV padronizado do Trello — processos, responsáveis, partes e kanban
          </p>
        </div>
        {etapa !== 'upload' && (
          <button
            onClick={resetar}
            className="flex items-center gap-2 text-sm text-[#6b7280] hover:text-[#1a1d23] transition-colors"
          >
            <RotateCcw size={14} /> Nova importação
          </button>
        )}
      </div>

      {/* Upload */}
      {etapa === 'upload' && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'bg-white rounded-lg border-2 border-dashed p-14 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all',
              dragging ? 'border-[#145A5B] bg-[#145A5B]/5' : 'border-[#e5e7eb] hover:border-[#145A5B]/40 hover:bg-[#f9fafb]',
            )}
          >
            <div className={cn('w-14 h-14 rounded-lg flex items-center justify-center', dragging ? 'bg-[#145A5B]/10' : 'bg-[#f3f4f6]')}>
              <Upload size={24} className={dragging ? 'text-[#1D5F60]' : 'text-[#9ca3af]'} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[#1a1d23]">
                {dragging ? 'Solte o arquivo aqui' : 'Clique ou arraste o CSV padronizado'}
              </p>
              <p className="text-xs text-[#9ca3af] mt-1">
                Arquivo: <code className="bg-[#f3f4f6] px-1 rounded">csv_padronizado_importacao_juridica_*.csv</code>
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) processarArquivo(f) }}
            />
          </div>

          {/* Mapeamento de colunas */}
          <div className="bg-white rounded-lg border border-[#e5e7eb] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Info size={14} className="text-[#1D5F60]" />
              <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider">
                O que será importado
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { campo: 'numero_processo',         destino: 'processos.numero_processo',       obs: 'Deduplicado — atualiza se já existir' },
                { campo: 'cliente_parte_principal', destino: 'clientes (cria se não existir)',   obs: 'Vincula ao processo' },
                { campo: 'parte_contraria',         destino: 'partes_processo + pessoas',        obs: 'Idempotente' },
                { campo: 'ultimo_andamento',        destino: 'processos.observacoes',            obs: 'Salvo como observação se campo estiver vazio' },
                { campo: 'responsavel_principal',   destino: 'profiles (por nome)',              obs: 'Sem fallback — null se não encontrar' },
                { campo: 'status_normalizado',      destino: 'processos.status + kanban_tasks',  obs: 'Encerrado/Arquivado não cria card kanban' },
                { campo: 'area_normalizada',        destino: 'processos.area_direito',           obs: 'Mapeado para valores do sistema' },
                { campo: 'data_vencimento',         destino: 'kanban_tasks.data',                obs: 'Prazo da tarefa' },
                { campo: 'card_id',                 destino: 'kanban_tasks.origem_id',           obs: 'Deduplicado — atualiza se já existir' },
              ].map(item => (
                <div key={item.campo} className="flex items-start gap-2.5 bg-[#f9fafb] rounded-xl px-3 py-2.5">
                  <code className="text-[10px] bg-white border border-[#e5e7eb] text-[#1D5F60] px-1.5 py-0.5 rounded shrink-0 mt-0.5 font-mono">
                    {item.campo}
                  </code>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-[#374151] truncate">→ {item.destino}</p>
                    <p className="text-[10px] text-[#9ca3af]">{item.obs}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Erro de arquivo */}
      {erroArquivo && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
          <AlertCircle size={15} className="shrink-0" />
          {erroArquivo}
          <button onClick={() => setErroArquivo('')} className="ml-auto">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Preview */}
      {etapa === 'preview' && rows.length > 0 && (
        <>
          {/* Estatísticas */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total de itens"   value={stats.total}          cor="gray" />
            <StatCard label="Ativos (c/ kanban)" value={stats.ativos}       cor="green" />
            <StatCard label="Encerrados"        value={stats.encerrados}     cor="amber" />
            <StatCard label="Sem responsável"   value={stats.semResponsavel} cor="red" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <InfoCard icon={<Scale size={14} />}  label="Com nº processo"    value={stats.comNumero} total={stats.total} />
            <InfoCard icon={<Users size={14} />}  label="Com responsável"    value={stats.comResponsavel} total={stats.total} />
            <InfoCard icon={<FileText size={14} />} label="Com parte contrária" value={stats.comParteContraria} total={stats.total} />
          </div>

          {/* Tabela de preview (primeiras 10 linhas) */}
          <div className="bg-white rounded-lg border border-[#e5e7eb] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#f3f4f6] flex items-center justify-between">
              <p className="text-sm font-semibold text-[#1a1d23]">Preview — primeiras 10 linhas</p>
              <span className="text-xs text-[#9ca3af]">{rows.length} itens no total</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#f9fafb] border-b border-[#f3f4f6]">
                    {['#', 'Nº Processo', 'Cliente', 'Parte Contrária', 'Responsável', 'Status', 'Área', 'Arquivado'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold text-[#9ca3af] uppercase tracking-wide text-[10px] whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((r, i) => {
                    const arquivado  = r.arquivado?.toLowerCase() === 'true'
                    const encerrado  = arquivado || r.status_normalizado?.toLowerCase().includes('conclu')
                    return (
                      <tr key={i} className={cn('border-b border-[#f9fafb]', encerrado ? 'opacity-50' : '')}>
                        <td className="px-4 py-2 text-[#9ca3af]">{i + 2}</td>
                        <td className="px-4 py-2 font-mono text-[11px] text-[#374151]">
                          {r.numero_processo?.trim() || <span className="text-amber-500 italic">sem número</span>}
                        </td>
                        <td className="px-4 py-2 text-[#374151] max-w-[140px] truncate">
                          {r.cliente_parte_principal?.trim() || <span className="text-[#c5cdd8]">—</span>}
                        </td>
                        <td className="px-4 py-2 text-[#374151] max-w-[140px] truncate">
                          {r.parte_contraria?.trim() || <span className="text-[#c5cdd8]">—</span>}
                        </td>
                        <td className="px-4 py-2">
                          {r.responsavel_principal?.trim()
                            ? <span className="bg-[#E8F2F2] text-[#1D5F60] px-2 py-0.5 rounded-full font-medium text-[10px]">{r.responsavel_principal}</span>
                            : <span className="bg-[#f3f4f6] text-[#9ca3af] px-2 py-0.5 rounded-full text-[10px]">sem responsável</span>
                          }
                        </td>
                        <td className="px-4 py-2">
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', encerrado ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700')}>
                            {r.status_normalizado?.trim() || 'ativo'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-[#9ca3af]">{r.area_normalizada?.trim() || '—'}</td>
                        <td className="px-4 py-2">
                          {arquivado && <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded">Arquivado</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Aviso sobre sem responsável */}
          {stats.semResponsavel > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
              <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <span className="font-semibold">{stats.semResponsavel} itens</span> sem responsável identificado.
                Eles serão importados com <code className="bg-amber-100 px-1 rounded text-xs">responsavel_id = null</code> e
                aparecerão na coluna "Sem responsável" do kanban geral.
                <span className="font-semibold"> Nenhum item será atribuído ao usuário logado.</span>
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="flex items-center justify-between">
            <button onClick={resetar} className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors">
              <X size={14} /> Cancelar
            </button>
            <button
              onClick={confirmar}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#145A5B] hover:bg-[#1B6E70] text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <ChevronRight size={15} />
              Confirmar Importação ({stats.total} itens)
            </button>
          </div>
        </>
      )}

      {/* Importando */}
      {etapa === 'importando' && (
        <div className="bg-white rounded-lg border border-[#e5e7eb] py-24 flex flex-col items-center gap-5">
          <Loader2 size={36} className="text-[#1D5F60] animate-spin" />
          <div className="text-center">
            <p className="text-sm font-semibold text-[#374151]">Importando dados…</p>
            <p className="text-xs text-[#9ca3af] mt-1">
              Processando {rows.length} itens. Não feche esta janela.
            </p>
          </div>
        </div>
      )}

      {/* Resultado */}
      {etapa === 'resultado' && relatorio && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total processado"  value={relatorio.total}              cor="gray"  />
            <StatCard label="Processos criados" value={relatorio.processos_criados}  cor="green" />
            <StatCard label="Tarefas kanban"    value={relatorio.tarefas_criadas}    cor="green" />
            <StatCard label="Rejeitados"        value={relatorio.rejeitados}         cor="red"   />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Processos atualizados" value={relatorio.processos_atualizados} cor="amber" />
            <StatCard label="Processos existentes"  value={relatorio.processos_existentes}  cor="gray"  />
            <StatCard label="Tarefas atualizadas"   value={relatorio.tarefas_atualizadas}   cor="amber" />
            <StatCard label="Sem responsável"       value={relatorio.sem_responsavel}        cor="amber" />
          </div>

          {/* Metadados */}
          <div className="bg-[#f9fafb] rounded-xl border border-[#e5e7eb] px-5 py-3.5 space-y-1.5">
            <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">Rastreabilidade</p>
            <p className="text-sm text-[#374151]">
              <span className="font-medium">Batch ID:</span>{' '}
              <code className="bg-white border border-[#e5e7eb] px-2 py-0.5 rounded text-[12px] text-[#1D5F60]">{relatorio.batch_id}</code>
            </p>
            <p className="text-sm text-[#374151]">
              <span className="font-medium">Tabelas afetadas:</span>{' '}
              {relatorio.tabelas_afetadas.length > 0
                ? relatorio.tabelas_afetadas.map(t => (
                    <code key={t} className="bg-white border border-[#e5e7eb] px-1.5 py-0.5 rounded text-[11px] mr-1">{t}</code>
                  ))
                : <span className="text-[#9ca3af]">nenhuma (sem alterações)</span>
              }
            </p>
            <p className="text-sm text-[#374151]">
              <span className="font-medium">Sem nº processo:</span>{' '}
              <span className="text-[#6b7280]">{relatorio.sem_numero} itens</span>
            </p>
          </div>

          {/* Log */}
          <div className="bg-white rounded-lg border border-[#e5e7eb] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#f3f4f6] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1a1d23]">Log de importação</h2>
              <span className="text-xs text-[#9ca3af]">{relatorio.log.length} entradas</span>
            </div>
            <div className="divide-y divide-[#f9fafb] max-h-96 overflow-y-auto">
              {relatorio.log.map((entry, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-3">
                  {entry.tipo === 'ok'    && <CheckCircle2  size={14} className="text-green-500 mt-0.5 shrink-0" />}
                  {entry.tipo === 'erro'  && <AlertCircle   size={14} className="text-red-500   mt-0.5 shrink-0" />}
                  {entry.tipo === 'aviso' && <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <span className="text-[11px] text-[#9ca3af] mr-2 font-mono">L{entry.linha}</span>
                    <span className="text-[12px] text-[#374151]">{entry.mensagem}</span>
                  </div>
                </div>
              ))}
              {relatorio.log.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-[#9ca3af]">
                  Nenhum evento registrado.
                </div>
              )}
            </div>
          </div>

          {/* Como testar */}
          <div className="bg-[#E8F2F2] rounded-lg px-5 py-4 space-y-2">
            <p className="text-[11px] font-semibold text-[#1D5F60] uppercase tracking-wider">Como testar no sistema</p>
            <ul className="text-[12px] text-[#1D5F60] space-y-1 list-disc list-inside">
              <li>Acesse <strong>/processos</strong> — verifique se os processos importados aparecem com parte contrária e responsável corretos</li>
              <li>Acesse <strong>/kanban</strong> — o quadro pessoal deve mostrar só suas tarefas; o geral, por responsável</li>
              <li>Acesse um processo importado e verifique a aba de partes — a parte contrária deve estar listada</li>
              <li>Filtre o kanban por responsável para confirmar que nenhum item ficou atribuído indevidamente ao seu usuário</li>
              <li>Para rastrear este lote, busque no banco por <code className="bg-[#D0DCDC] px-1 rounded">kanban_tasks WHERE descricao ILIKE '%{relatorio.batch_id.slice(0,8)}%'</code></li>
            </ul>
          </div>

          <div className="flex justify-end">
            <button
              onClick={resetar}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#145A5B] hover:bg-[#1B6E70] text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <RotateCcw size={14} /> Nova importação
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function StatCard({ label, value, cor }: { label: string; value: number; cor: 'gray' | 'green' | 'amber' | 'red' }) {
  const cores = {
    gray:  'text-[#1a1d23]',
    green: 'text-green-600',
    amber: 'text-amber-600',
    red:   'text-red-600',
  }
  return (
    <div className="bg-white rounded-lg border border-[#e5e7eb] p-5">
      <p className="text-xs text-[#9ca3af] mb-2 leading-tight">{label}</p>
      <p className={cn('text-3xl font-bold', cores[cor])}>{value}</p>
    </div>
  )
}

function InfoCard({ icon, label, value, total }: { icon: React.ReactNode; label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="bg-white rounded-lg border border-[#e5e7eb] p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[#9ca3af]">{icon}</span>
        <span className="text-[11px] font-medium text-[#6b7280]">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[#1a1d23]">{value}</p>
      <div className="mt-2 h-1.5 bg-[#f3f4f6] rounded-full overflow-hidden">
        <div className="h-full bg-[#145A5B] rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-[#9ca3af] mt-1">{pct}% do total</p>
    </div>
  )
}
