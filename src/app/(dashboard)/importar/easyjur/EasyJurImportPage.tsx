'use client'

import { useRef, useState, useCallback, type ReactNode } from 'react'
import {
  Upload, FileText, X, CheckCircle, AlertTriangle, Loader2,
  Download, ChevronDown, ChevronRight, ArrowRight, RefreshCw,
  Scale, Users, Clock, Banknote, FileSearch,
} from 'lucide-react'
import { parseEasyJurHtml } from '@/lib/easyjur/html-parser'
import type { EasyJurImportResult, EasyJurParseResult, EasyJurProcesso } from '@/types/easyjur'
import { cn, formatDate } from '@/lib/utils'

// ── Tipos de fase ─────────────────────────────────────────────────────────────

type Fase = 'upload' | 'analisando' | 'preview' | 'importando' | 'resultado'

// ── Componente principal ──────────────────────────────────────────────────────

export default function EasyJurImportPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fase,       setFase]       = useState<Fase>('upload')
  const [parsed,     setParsed]     = useState<EasyJurParseResult | null>(null)
  const [resultado,  setResultado]  = useState<EasyJurImportResult | null>(null)
  const [erro,       setErro]       = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  // ── Upload e parse ──────────────────────────────────────────────────────────

  const processarArquivo = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.html') && !file.name.toLowerCase().endsWith('.htm')) {
      setErro('Tipo de arquivo inválido. Selecione um arquivo .html exportado do EasyJur.')
      return
    }
    if (file.size > 30 * 1024 * 1024) {
      setErro('Arquivo muito grande. Limite: 30 MB.')
      return
    }

    setErro('')
    setFase('analisando')
    try {
      const texto = await file.text()
      const result = parseEasyJurHtml(texto, file.name)
      setParsed(result)
      setFase('preview')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado ao processar o arquivo.')
      setFase('upload')
    }
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processarArquivo(file)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) processarArquivo(file)
  }

  // ── CSV download ──────────────────────────────────────────────────────────

  function baixarCsv() {
    if (!parsed) return
    const linhas = [
      ['Número', 'Cliente', 'Parte Contrária', 'Responsável', 'Status', 'Área', 'Tribunal', 'Vara', 'Último Andamento', 'Prazos', 'Andamentos'].join(','),
      ...parsed.processos.map(p => [
        p.numero_processo ?? '',
        p.cliente ?? '',
        p.parte_contraria ?? '',
        p.responsavel ?? '',
        p.status ?? '',
        p.area_direito ?? '',
        p.tribunal ?? '',
        p.vara ?? '',
        (p.ultimo_andamento ?? '').slice(0, 100),
        p.prazos.length + p.audiencias.length,
        p.andamentos.length,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ]
    const blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `easyjur_${Date.now()}.csv`
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  // ── Importação ────────────────────────────────────────────────────────────

  async function importar() {
    if (!parsed || parsed.processos.length === 0) return
    setFase('importando')
    try {
      const res = await fetch('/api/importar/easyjur', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processos: parsed.processos, arquivo_nome: parsed.arquivo_nome }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setErro(body.error ?? `Erro ${res.status} ao importar.`)
        setFase('preview')
        return
      }
      const data: EasyJurImportResult = await res.json()
      setResultado(data)
      setFase('resultado')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado ao importar.')
      setFase('preview')
    }
  }

  function reiniciar() {
    setFase('upload'); setParsed(null); setResultado(null); setErro(''); setExpandidos(new Set())
  }

  function toggleExpandido(num: string) {
    setExpandidos(prev => {
      const next = new Set(prev)
      next.has(num) ? next.delete(num) : next.add(num)
      return next
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-[0.15em]">Importações</p>
          <h1 className="text-[22px] font-semibold text-[#0f1923] mt-1 flex items-center gap-2">
            <FileSearch size={20} className="text-[#145A5B]" />
            Importar EasyJur
          </h1>
          <p className="text-[13px] text-[#7a8899] mt-1">
            Faça upload do Relatório Analítico exportado como HTML e importe processos, partes, prazos e andamentos.
          </p>
        </div>
        {fase !== 'upload' && (
          <button onClick={reiniciar} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[#6b7280] hover:text-[#374151] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors">
            <RefreshCw size={12} /> Novo arquivo
          </button>
        )}
      </div>

      {/* ── FASE: Upload ───────────────────────────────────────────────────── */}
      {fase === 'upload' && (
        <div className="space-y-4">
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-colors',
              isDragging ? 'border-[#145A5B] bg-[#f0f7f7]' : 'border-[#e5e7eb] hover:border-[#145A5B]/40 hover:bg-[#f9fafb]',
            )}
          >
            <input ref={inputRef} type="file" accept=".html,.htm" className="hidden" onChange={handleInput} />
            <div className="flex flex-col items-center gap-3">
              <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center transition-colors', isDragging ? 'bg-[#145A5B]/15' : 'bg-[#f3f4f6]')}>
                <Upload size={24} className={isDragging ? 'text-[#145A5B]' : 'text-[#9ca3af]'} />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#374151]">
                  {isDragging ? 'Solte o arquivo aqui' : 'Arraste o HTML ou clique para selecionar'}
                </p>
                <p className="text-[12px] text-[#9ca3af] mt-1">Relatório Analítico do EasyJur · .html · máx. 30 MB</p>
              </div>
            </div>
          </div>

          {erro && <ErroBox>{erro}</ErroBox>}

          <div className="bg-[#f9fafb] rounded-2xl border border-[#f3f4f6] p-5 space-y-3">
            <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">Como exportar do EasyJur</p>
            <ol className="space-y-2 text-[13px] text-[#6b7280]">
              <li className="flex items-start gap-2"><Dot>1</Dot>Acesse o processo no EasyJur</li>
              <li className="flex items-start gap-2"><Dot>2</Dot>Vá em <strong>Relatórios → Relatório Analítico</strong></li>
              <li className="flex items-start gap-2"><Dot>3</Dot>No navegador, pressione <kbd className="text-[11px] border border-[#d1d5db] rounded px-1.5 py-0.5 bg-white">Ctrl+S</kbd> e salve como <strong>Página Web Completa</strong> (.html)</li>
              <li className="flex items-start gap-2"><Dot>4</Dot>Faça upload do arquivo salvo aqui</li>
            </ol>
          </div>
        </div>
      )}

      {/* ── FASE: Analisando ───────────────────────────────────────────────── */}
      {fase === 'analisando' && (
        <div className="bg-white border border-[#e5e7eb] rounded-2xl p-16 flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-[#f0f7f7] rounded-2xl flex items-center justify-center">
            <Loader2 size={24} className="text-[#145A5B] animate-spin" />
          </div>
          <p className="text-[14px] font-semibold text-[#0f1923]">Analisando HTML…</p>
          <p className="text-[12px] text-[#9ca3af]">Extraindo processos, partes, andamentos e prazos</p>
        </div>
      )}

      {/* ── FASE: Preview ──────────────────────────────────────────────────── */}
      {fase === 'preview' && parsed && (
        <div className="space-y-5">
          {/* Sumário */}
          <div className="bg-white border border-[#e5e7eb] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <FileText size={16} className="text-[#9ca3af] shrink-0" />
                <span className="text-[13px] font-medium text-[#374151] truncate">{parsed.arquivo_nome}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={baixarCsv} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[#6b7280] hover:text-[#374151] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors">
                  <Download size={12} /> Baixar CSV
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metrica label="Processos" value={parsed.total_encontrados} color="text-[#0f1923]" bg="bg-[#f9fafb]" />
              <Metrica label="Com cliente" value={parsed.processos.filter(p => p.cliente).length} color="text-emerald-700" bg="bg-emerald-50" />
              <Metrica label="Com responsável" value={parsed.processos.filter(p => p.responsavel).length} color="text-blue-700" bg="bg-blue-50" />
              <Metrica label="Com prazos" value={parsed.processos.filter(p => p.prazos.length + p.audiencias.length > 0).length} color="text-amber-700" bg="bg-amber-50" />
            </div>

            {parsed.erros_parse.length > 0 && (
              <div className="space-y-1">
                {parsed.erros_parse.map((e, i) => <ErroBox key={i}>{e}</ErroBox>)}
              </div>
            )}
          </div>

          {/* Lista de processos */}
          <div className="space-y-3">
            {parsed.processos.map(proc => {
              const num = proc.numero_processo ?? '(sem número)'
              const aberto = expandidos.has(num)
              return (
                <div key={num} className="bg-white border border-[#e5e7eb] rounded-2xl overflow-hidden">
                  {/* Header do processo */}
                  <button
                    onClick={() => toggleExpandido(num)}
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#f9fafb] transition-colors text-left"
                  >
                    <Scale size={15} className="text-[#145A5B] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#0f1923] font-mono">{num}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {proc.cliente && <Tag>{proc.cliente}</Tag>}
                        {proc.status && <Tag color="blue">{proc.status}</Tag>}
                        {proc.area_direito && <Tag color="violet">{proc.area_direito}</Tag>}
                        {proc.campos_nao_encontrados.length > 0 && (
                          <span className="text-[10px] text-amber-600 flex items-center gap-1">
                            <AlertTriangle size={10} /> {proc.campos_nao_encontrados.length} campo(s) não encontrado(s)
                          </span>
                        )}
                      </div>
                    </div>
                    {aberto ? <ChevronDown size={14} className="text-[#9ca3af] shrink-0" /> : <ChevronRight size={14} className="text-[#9ca3af] shrink-0" />}
                  </button>

                  {/* Detalhes expandidos */}
                  {aberto && <ProcessoDetalhe proc={proc} />}
                </div>
              )
            })}
          </div>

          {/* Rodapé */}
          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <div>
              {erro && <ErroBox>{erro}</ErroBox>}
            </div>
            <button
              onClick={importar}
              disabled={parsed.processos.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#145A5B] hover:bg-[#0f4243] text-white text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-40 shadow-sm"
            >
              <ArrowRight size={15} />
              Importar {parsed.processos.length} processo{parsed.processos.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* ── FASE: Importando ───────────────────────────────────────────────── */}
      {fase === 'importando' && (
        <div className="bg-white border border-[#e5e7eb] rounded-2xl p-16 flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-[#f0f7f7] rounded-2xl flex items-center justify-center">
            <Loader2 size={24} className="text-[#145A5B] animate-spin" />
          </div>
          <p className="text-[14px] font-semibold text-[#0f1923]">Importando processos…</p>
          <p className="text-[12px] text-[#9ca3af]">Criando e atualizando registros no banco de dados</p>
        </div>
      )}

      {/* ── FASE: Resultado ────────────────────────────────────────────────── */}
      {fase === 'resultado' && resultado && (
        <div className="space-y-5">
          {/* Cards */}
          <div className="bg-white border border-[#e5e7eb] rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <CheckCircle size={20} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-[#0f1923]">Importação concluída</p>
                <p className="text-[11px] text-[#9ca3af]">Batch: {resultado.import_batch_id.slice(0, 8)}…</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              <Metrica label="Criados"    value={resultado.criados}          color="text-emerald-700" bg="bg-emerald-50" />
              <Metrica label="Atualizados" value={resultado.atualizados}     color="text-blue-700"   bg="bg-blue-50" />
              <Metrica label="Ignorados"  value={resultado.ignorados}        color="text-amber-700"  bg="bg-amber-50" />
              <Metrica label="Erros"      value={resultado.erros}            color="text-red-700"    bg="bg-red-50" />
              <Metrica label="Prazos"     value={resultado.prazos_inseridos} color="text-violet-700" bg="bg-violet-50" />
              <Metrica label="Partes"     value={resultado.partes_inseridas} color="text-teal-700"   bg="bg-teal-50" />
            </div>
          </div>

          {/* Log */}
          {resultado.log.length > 0 && (
            <div className="bg-white border border-[#e5e7eb] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                <p className="text-[12px] font-semibold text-[#374151]">Log da importação ({resultado.log.length})</p>
              </div>
              <div className="divide-y divide-[#f9fafb] max-h-80 overflow-y-auto">
                {resultado.log.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3">
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5',
                      entry.acao === 'criado'    ? 'bg-emerald-50 text-emerald-700' :
                      entry.acao === 'atualizado'? 'bg-blue-50 text-blue-700' :
                      entry.acao === 'ignorado'  ? 'bg-amber-50 text-amber-700' :
                                                   'bg-red-50 text-red-700'
                    )}>{entry.acao}</span>
                    <div className="flex-1 min-w-0">
                      {entry.numero_processo && (
                        <p className="text-[11px] text-[#9ca3af] font-mono">{entry.numero_processo}</p>
                      )}
                      <p className="text-[12px] text-[#374151]">{entry.mensagem}</p>
                      {entry.campos_atualizados && entry.campos_atualizados.length > 0 && (
                        <p className="text-[11px] text-[#9ca3af]">Campos: {entry.campos_atualizados.join(', ')}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={reiniciar} className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors">
              <Upload size={13} /> Novo arquivo
            </button>
            <a href="/processos" className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold text-[#145A5B] border border-[#145A5B]/30 rounded-xl hover:bg-[#f0f7f7] transition-colors">
              Ver processos importados →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-componente: detalhe de um processo no preview ─────────────────────────

function ProcessoDetalhe({ proc }: { proc: EasyJurProcesso }) {
  return (
    <div className="border-t border-[#f3f4f6] divide-y divide-[#f9fafb]">
      {/* Campos básicos */}
      <div className="px-5 py-4 grid grid-cols-1 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 text-[12px]">
        <Campo label="Parte contrária" valor={proc.parte_contraria} />
        <Campo label="Responsável" valor={proc.responsavel} />
        <Campo label="Tribunal" valor={proc.tribunal} />
        <Campo label="Vara" valor={proc.vara} />
        <Campo label="Status" valor={proc.status} />
        <Campo label="Área" valor={proc.area_direito} />
      </div>

      {/* Último andamento */}
      {proc.ultimo_andamento && (
        <div className="px-5 py-3">
          <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1">Último andamento</p>
          <p className="text-[12px] text-[#374151] leading-relaxed line-clamp-3">{proc.ultimo_andamento}</p>
        </div>
      )}

      {/* Partes vinculadas */}
      {proc.partes_vinculadas.length > 0 && (
        <div className="px-5 py-3">
          <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Users size={10} /> Partes vinculadas ({proc.partes_vinculadas.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {proc.partes_vinculadas.map((p, i) => <Tag key={i}>{p}</Tag>)}
          </div>
        </div>
      )}

      {/* Prazos e audiências */}
      {(proc.prazos.length + proc.audiencias.length) > 0 && (
        <div className="px-5 py-3">
          <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2 flex items-center gap-1">
            <Clock size={10} /> Prazos e audiências ({proc.prazos.length + proc.audiencias.length})
          </p>
          <div className="space-y-1">
            {[...proc.prazos, ...proc.audiencias].slice(0, 5).map((pr, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold',
                  pr.tipo === 'audiencia' ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'
                )}>{pr.tipo}</span>
                <span className="text-[#374151]">{pr.titulo}</span>
                {pr.data && <span className="text-[#9ca3af] ml-auto">{pr.data}</span>}
              </div>
            ))}
            {proc.prazos.length + proc.audiencias.length > 5 && (
              <p className="text-[11px] text-[#9ca3af]">+{proc.prazos.length + proc.audiencias.length - 5} mais…</p>
            )}
          </div>
        </div>
      )}

      {/* Financeiro */}
      {(proc.honorarios.length + proc.custas.length + proc.alvaras.length) > 0 && (
        <div className="px-5 py-3">
          <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Banknote size={10} /> Financeiro ({proc.honorarios.length + proc.custas.length + proc.alvaras.length} registros)
          </p>
          <p className="text-[11px] text-[#9ca3af]">Honorários, custas e alvarás detectados — não importados automaticamente.</p>
        </div>
      )}

      {/* Campos não encontrados */}
      {proc.campos_nao_encontrados.length > 0 && (
        <div className="px-5 py-3 bg-amber-50/50">
          <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1">Campos não encontrados no HTML</p>
          <p className="text-[11px] text-amber-700">{proc.campos_nao_encontrados.join(', ')}</p>
        </div>
      )}
    </div>
  )
}

// ── Primitivos visuais ────────────────────────────────────────────────────────

function Metrica({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={cn('rounded-xl p-3.5 text-center border border-[#f3f4f6]', bg)}>
      <p className={cn('text-[22px] font-bold tabular-nums leading-none', color)}>{value}</p>
      <p className="text-[10px] text-[#9ca3af] mt-1.5">{label}</p>
    </div>
  )
}

function Campo({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div>
      <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">{label}:</span>{' '}
      <span className={valor ? 'text-[#374151]' : 'text-[#c4cdd5]'}>{valor ?? '—'}</span>
    </div>
  )
}

function Tag({ children, color }: { children: ReactNode; color?: 'blue' | 'violet' | 'gray' }) {
  const cls = color === 'blue' ? 'bg-blue-50 text-blue-700'
    : color === 'violet' ? 'bg-violet-50 text-violet-700'
    : 'bg-[#f3f4f6] text-[#6b7280]'
  return <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', cls)}>{children}</span>
}

function Dot({ children }: { children: ReactNode }) {
  return <span className="w-5 h-5 rounded-full bg-[#145A5B]/15 text-[#145A5B] text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{children}</span>
}

function ErroBox({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700 leading-relaxed">
      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  )
}
