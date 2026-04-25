'use client'

import {
  useRef, useState, useCallback, type ReactNode,
} from 'react'
import {
  Upload, FileText, X, CheckCircle, AlertTriangle, Loader2,
  Download, ChevronDown, ChevronRight, ArrowRight, RefreshCw,
  Scale, Users, Clock, Banknote, FileSearch, Info,
  Building2, CalendarDays, Gavel, AlignLeft, ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import { parseEasyJurHtml } from '@/lib/easyjur/html-parser'
import type { EasyJurImportResult, EasyJurParseResult, EasyJurProcesso } from '@/types/easyjur'
import { cn } from '@/lib/utils'

type Fase = 'upload' | 'analisando' | 'preview' | 'importando' | 'resultado'

const STATUS_COR: Record<string, string> = {
  'ativo': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'suspenso': 'bg-amber-50 text-amber-700 border-amber-200',
  'arquivado': 'bg-slate-50 text-slate-600 border-slate-200',
  'encerrado': 'bg-blue-50 text-blue-700 border-blue-200',
}

export default function EasyJurImport() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fase,       setFase]       = useState<Fase>('upload')
  const [parsed,     setParsed]     = useState<EasyJurParseResult | null>(null)
  const [resultado,  setResultado]  = useState<EasyJurImportResult & { kanban_criadas?: number } | null>(null)
  const [erro,       setErro]       = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [criarKanban, setCriarKanban] = useState(false)
  const [showLog,    setShowLog]    = useState(false)

  // ── Processar arquivo ─────────────────────────────────────────────────────

  const processarArquivo = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().match(/\.html?$/)) {
      setErro('Selecione um arquivo .html exportado do EasyJur.')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setErro('Arquivo muito grande. Limite: 50 MB.')
      return
    }
    setErro('')
    setFase('analisando')
    try {
      const texto  = await file.text()
      const result = parseEasyJurHtml(texto, file.name)
      setParsed(result)
      setFase('preview')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao processar arquivo.')
      setFase('upload')
    }
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processarArquivo(file)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (file) processarArquivo(file)
  }

  // ── CSV ───────────────────────────────────────────────────────────────────

  function baixarCsv() {
    if (!parsed) return
    const linhas = [
      ['Número', 'Título', 'Cliente', 'Parte Contrária', 'Responsável', 'Status', 'Área', 'Tribunal', 'Vara', 'Último Andamento', 'Andamentos', 'Prazos+Audiências'].join(','),
      ...parsed.processos.map(p => [
        p.numero_processo ?? '', p.titulo ?? '', p.cliente ?? '',
        p.parte_contraria ?? '', p.responsavel ?? '', p.status ?? '',
        p.area_direito ?? '', p.tribunal ?? '', p.vara ?? '',
        (p.ultimo_andamento ?? '').slice(0, 120),
        p.andamentos.length, p.prazos.length + p.audiencias.length,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ]
    const blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `easyjur_${Date.now()}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  // ── Importar ──────────────────────────────────────────────────────────────

  async function importar() {
    if (!parsed || !parsed.processos.length) return
    setFase('importando')
    try {
      const res = await fetch('/api/processos/importar-easyjur', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processos:    parsed.processos,
          arquivo_nome: parsed.arquivo_nome,
          criar_kanban: criarKanban,
        }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        setErro(b.error ?? `Erro ${res.status}`)
        setFase('preview')
        return
      }
      setResultado(await res.json())
      setFase('resultado')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado.')
      setFase('preview')
    }
  }

  function reiniciar() {
    setFase('upload'); setParsed(null); setResultado(null)
    setErro(''); setExpandidos(new Set()); setShowLog(false)
  }

  function toggleExpandido(num: string) {
    setExpandidos(prev => { const n = new Set(prev); n.has(num) ? n.delete(num) : n.add(num); return n })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[11px] text-[#9ca3af] mb-2">
            <Link href="/processos" className="hover:text-[#374151] flex items-center gap-1 transition-colors">
              <ArrowLeft size={11} /> Processos
            </Link>
            <span>/</span>
            <span className="text-[#374151]">Importar EasyJur</span>
          </div>
          <h1 className="text-[22px] font-semibold text-[#0f1923] flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#145A5B] rounded-xl flex items-center justify-center">
              <FileSearch size={16} className="text-white" />
            </div>
            Importar EasyJur
          </h1>
          <p className="text-[13px] text-[#7a8899] mt-1">
            Upload do Relatório Analítico HTML → extração automática → importação para o banco
          </p>
        </div>
        {fase !== 'upload' && (
          <button onClick={reiniciar}
            className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-[#6b7280] hover:text-[#374151] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors">
            <RefreshCw size={12} /> Novo arquivo
          </button>
        )}
      </div>

      {/* ── FASE: Upload ──────────────────────────────────────────────────── */}
      {fase === 'upload' && (
        <div className="space-y-4">
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all',
              isDragging
                ? 'border-[#145A5B] bg-[#f0f7f7] scale-[1.01]'
                : 'border-[#e5e7eb] hover:border-[#145A5B]/50 hover:bg-[#fafafa]',
            )}
          >
            <input ref={inputRef} type="file" accept=".html,.htm" className="hidden" onChange={handleInput} />
            <div className="flex flex-col items-center gap-4">
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center transition-colors',
                isDragging ? 'bg-[#145A5B] text-white' : 'bg-[#f3f4f6] text-[#9ca3af]',
              )}>
                <Upload size={28} />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[#0f1923]">
                  {isDragging ? 'Solte o arquivo' : 'Arraste o HTML aqui'}
                </p>
                <p className="text-[13px] text-[#9ca3af] mt-1">
                  ou <span className="text-[#145A5B] font-medium cursor-pointer">clique para selecionar</span>
                  {' '}· Relatório Analítico do EasyJur · .html · até 50 MB
                </p>
              </div>
            </div>
          </div>

          {erro && <AvisoBox type="erro">{erro}</AvisoBox>}

          {/* Instruções */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-[#f3f4f6] rounded-2xl p-5">
              <p className="text-[12px] font-semibold text-[#374151] mb-3">Como exportar do EasyJur</p>
              <ol className="space-y-2.5">
                {[
                  'Abra o EasyJur e vá em Processos',
                  'Selecione um ou mais processos',
                  'Clique em Relatórios → Relatório Analítico',
                  'No navegador: Ctrl+S → "Página Web Completa"',
                  'Faça upload do arquivo .html aqui',
                ].map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[12px] text-[#6b7280]">
                    <span className="w-5 h-5 rounded-full bg-[#145A5B]/15 text-[#145A5B] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
            <div className="bg-[#f0f7f7] border border-[#145A5B]/15 rounded-2xl p-5 space-y-2">
              <p className="text-[12px] font-semibold text-[#145A5B]">O que será extraído</p>
              {[
                ['Processos', 'número, título, tipo de ação, fase'],
                ['Partes', 'cliente, polo ativo/passivo, vinculadas'],
                ['Responsável', 'advogado → perfil do sistema'],
                ['Andamentos', 'histórico + último andamento real'],
                ['Agenda', 'prazos, audiências, tarefas'],
                ['Financeiro', 'honorários, custas, alvarás'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start gap-2 text-[12px]">
                  <CheckCircle size={12} className="text-[#145A5B] shrink-0 mt-0.5" />
                  <span><strong className="text-[#0f1923]">{k}:</strong> <span className="text-[#6b7280]">{v}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── FASE: Analisando ──────────────────────────────────────────────── */}
      {fase === 'analisando' && (
        <div className="bg-white border border-[#e5e7eb] rounded-2xl p-20 flex flex-col items-center gap-5">
          <div className="relative">
            <div className="w-16 h-16 bg-[#f0f7f7] rounded-2xl flex items-center justify-center">
              <Loader2 size={28} className="text-[#145A5B] animate-spin" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-[15px] font-semibold text-[#0f1923]">Analisando relatório…</p>
            <p className="text-[13px] text-[#9ca3af] mt-1">Extraindo processos, partes, andamentos e agenda</p>
          </div>
        </div>
      )}

      {/* ── FASE: Preview ─────────────────────────────────────────────────── */}
      {fase === 'preview' && parsed && (
        <div className="space-y-5">
          {/* Barra de arquivo + ações */}
          <div className="bg-white border border-[#e5e7eb] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#f3f4f6] rounded-lg flex items-center justify-center">
                  <FileText size={15} className="text-[#9ca3af]" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[#0f1923]">{parsed.arquivo_nome}</p>
                  <p className="text-[11px] text-[#9ca3af]">{parsed.total_encontrados} processo{parsed.total_encontrados !== 1 ? 's' : ''} encontrado{parsed.total_encontrados !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={reiniciar} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[#6b7280] hover:text-[#374151] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors">
                  Trocar
                </button>
                <button onClick={baixarCsv} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[#145A5B] border border-[#145A5B]/30 rounded-xl hover:bg-[#f0f7f7] transition-colors">
                  <Download size={12} /> Baixar CSV
                </button>
              </div>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              <Metrica icon={<Scale size={13} />} label="Processos" value={parsed.total_encontrados} cor="text-[#0f1923]" bg="bg-[#f9fafb]" />
              <Metrica icon={<Building2 size={13} />} label="Com cliente" value={parsed.processos.filter(p => p.cliente).length} cor="text-emerald-700" bg="bg-emerald-50" />
              <Metrica icon={<Users size={13} />} label="Com responsável" value={parsed.processos.filter(p => p.responsavel).length} cor="text-blue-700" bg="bg-blue-50" />
              <Metrica icon={<Gavel size={13} />} label="Com contrário" value={parsed.processos.filter(p => p.parte_contraria).length} cor="text-violet-700" bg="bg-violet-50" />
              <Metrica icon={<Clock size={13} />} label="Com agenda" value={parsed.processos.filter(p => p.prazos.length + p.audiencias.length > 0).length} cor="text-amber-700" bg="bg-amber-50" />
              <Metrica icon={<AlignLeft size={13} />} label="Com andamentos" value={parsed.processos.filter(p => p.andamentos.length > 0).length} cor="text-teal-700" bg="bg-teal-50" />
            </div>

            {/* Erros globais do parse */}
            {parsed.erros_parse.map((e, i) => <AvisoBox key={i} type="erro">{e}</AvisoBox>)}
          </div>

          {/* Opção kanban */}
          <label className="flex items-center gap-3 px-4 py-3 bg-white border border-[#e5e7eb] rounded-xl cursor-pointer hover:bg-[#f9fafb] transition-colors w-fit">
            <input type="checkbox" checked={criarKanban} onChange={e => setCriarKanban(e.target.checked)}
              className="w-4 h-4 accent-[#145A5B]" />
            <div>
              <p className="text-[13px] font-medium text-[#374151]">Criar tarefas no Kanban</p>
              <p className="text-[11px] text-[#9ca3af]">Cria uma tarefa para cada processo com responsável definido</p>
            </div>
          </label>

          {/* Lista de processos */}
          <div className="space-y-2.5">
            {parsed.processos.map(proc => {
              const num    = proc.numero_processo ?? '(sem número)'
              const aberto = expandidos.has(num)
              const naoOk  = proc.campos_nao_encontrados.length

              return (
                <div key={num} className="bg-white border border-[#e5e7eb] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  <button onClick={() => toggleExpandido(num)}
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#fafafa] transition-colors text-left">
                    <Scale size={15} className="text-[#145A5B] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-semibold text-[#0f1923] font-mono">{num}</p>
                        {proc.status && (
                          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', STATUS_COR[proc.status?.toLowerCase()] ?? 'bg-slate-50 text-slate-600 border-slate-200')}>
                            {proc.status}
                          </span>
                        )}
                        {proc.area_direito && (
                          <span className="text-[10px] text-[#6b7280] bg-[#f3f4f6] px-2 py-0.5 rounded-full">{proc.area_direito}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-[#9ca3af] flex-wrap">
                        {proc.cliente && <span>{proc.cliente}</span>}
                        {proc.parte_contraria && <span className="text-[#6b7280]">× {proc.parte_contraria}</span>}
                        {proc.responsavel && <span className="text-blue-600">{proc.responsavel}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {naoOk > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={9} /> {naoOk} sem dado
                        </span>
                      )}
                      {aberto ? <ChevronDown size={14} className="text-[#9ca3af]" /> : <ChevronRight size={14} className="text-[#9ca3af]" />}
                    </div>
                  </button>

                  {aberto && <ProcessoDetalhe proc={proc} />}
                </div>
              )
            })}
          </div>

          {/* Rodapé */}
          <div className="flex items-center justify-between gap-3 flex-wrap py-2">
            <div>{erro && <AvisoBox type="erro">{erro}</AvisoBox>}</div>
            <button onClick={importar} disabled={parsed.processos.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#145A5B] hover:bg-[#0f4243] text-white text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-40 shadow-sm">
              <ArrowRight size={15} />
              Importar {parsed.processos.length} processo{parsed.processos.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* ── FASE: Importando ──────────────────────────────────────────────── */}
      {fase === 'importando' && (
        <div className="bg-white border border-[#e5e7eb] rounded-2xl p-20 flex flex-col items-center gap-5">
          <div className="w-16 h-16 bg-[#f0f7f7] rounded-2xl flex items-center justify-center">
            <Loader2 size={28} className="text-[#145A5B] animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-[15px] font-semibold text-[#0f1923]">Importando processos…</p>
            <p className="text-[13px] text-[#9ca3af] mt-1">
              Criando e atualizando registros · {(parsed?.processos.length ?? 0)} processo{(parsed?.processos.length ?? 0) !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* ── FASE: Resultado ───────────────────────────────────────────────── */}
      {fase === 'resultado' && resultado && (
        <div className="space-y-5">
          <div className="bg-white border border-[#e5e7eb] rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center">
                <CheckCircle size={22} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-[15px] font-bold text-[#0f1923]">Importação concluída</p>
                <p className="text-[11px] text-[#9ca3af] font-mono">Batch: {resultado.import_batch_id}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              <Metrica icon={<CheckCircle size={13} />} label="Criados"    value={resultado.criados}           cor="text-emerald-700" bg="bg-emerald-50" />
              <Metrica icon={<RefreshCw size={13} />}  label="Atualizados" value={resultado.atualizados}       cor="text-blue-700"   bg="bg-blue-50" />
              <Metrica icon={<Info size={13} />}        label="Ignorados"   value={resultado.ignorados}         cor="text-amber-700"  bg="bg-amber-50" />
              <Metrica icon={<AlertTriangle size={13} />} label="Erros"     value={resultado.erros}             cor="text-red-700"    bg="bg-red-50" />
              <Metrica icon={<Clock size={13} />}       label="Prazos"      value={resultado.prazos_inseridos}  cor="text-violet-700" bg="bg-violet-50" />
              <Metrica icon={<Users size={13} />}       label="Partes"      value={resultado.partes_inseridas}  cor="text-teal-700"   bg="bg-teal-50" />
              <Metrica icon={<Gavel size={13} />}       label="Kanban"      value={resultado.kanban_criadas ?? 0} cor="text-orange-700" bg="bg-orange-50" />
            </div>
          </div>

          {/* Log detalhado */}
          {resultado.log.length > 0 && (
            <div className="bg-white border border-[#e5e7eb] rounded-2xl overflow-hidden">
              <button onClick={() => setShowLog(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3.5 bg-[#f9fafb] border-b border-[#f3f4f6] hover:bg-[#f3f4f6] transition-colors text-left">
                <p className="text-[12px] font-semibold text-[#374151]">Log da importação ({resultado.log.length})</p>
                {showLog ? <ChevronDown size={14} className="text-[#9ca3af]" /> : <ChevronRight size={14} className="text-[#9ca3af]" />}
              </button>
              {showLog && (
                <div className="divide-y divide-[#f9fafb] max-h-80 overflow-y-auto">
                  {resultado.log.map((entry, i) => (
                    <div key={i} className="flex items-start gap-3 px-5 py-3">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 border',
                        entry.acao === 'criado'     ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        entry.acao === 'atualizado' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        entry.acao === 'ignorado'   ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                      'bg-red-50 text-red-700 border-red-200'
                      )}>{entry.acao}</span>
                      <div className="flex-1 min-w-0">
                        {entry.numero_processo && <p className="text-[10px] text-[#9ca3af] font-mono">{entry.numero_processo}</p>}
                        <p className="text-[12px] text-[#374151]">{entry.mensagem}</p>
                        {entry.campos_atualizados?.length && (
                          <p className="text-[10px] text-[#9ca3af]">Campos: {entry.campos_atualizados.join(', ')}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={reiniciar}
              className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors">
              <Upload size={13} /> Novo arquivo
            </button>
            <Link href="/processos"
              className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold text-[#145A5B] border border-[#145A5B]/30 rounded-xl hover:bg-[#f0f7f7] transition-colors">
              Ver processos importados →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Detalhe de um processo no preview ─────────────────────────────────────────

function ProcessoDetalhe({ proc }: { proc: EasyJurProcesso }) {
  const extra = (proc as EasyJurProcesso & { _extra?: Record<string, string | null> })._extra

  return (
    <div className="border-t border-[#f3f4f6] bg-[#fafafa]">
      {/* Campos básicos */}
      <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 text-[12px]">
        <Campo label="Tribunal"    valor={proc.tribunal} />
        <Campo label="Vara"        valor={proc.vara} />
        {extra?.tipo_acao     && <Campo label="Tipo de ação"    valor={extra.tipo_acao} />}
        {extra?.fase_processual && <Campo label="Fase"          valor={extra.fase_processual} />}
        {extra?.instancia     && <Campo label="Instância"       valor={extra.instancia} />}
        {extra?.valor_causa   && <Campo label="Valor da causa"  valor={extra.valor_causa} />}
        {extra?.data_distribuicao && <Campo label="Distribuição" valor={extra.data_distribuicao} />}
        {extra?.polo_ativo    && <Campo label="Polo ativo"      valor={extra.polo_ativo} />}
        {extra?.polo_passivo  && <Campo label="Polo passivo"    valor={extra.polo_passivo} />}
      </div>

      {/* Último andamento */}
      {proc.ultimo_andamento && (
        <div className="px-5 py-3 border-t border-[#f3f4f6]">
          <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <AlignLeft size={10} /> Último andamento
          </p>
          <p className="text-[12px] text-[#374151] leading-relaxed line-clamp-3">{proc.ultimo_andamento}</p>
          {proc.andamentos.length > 1 && (
            <p className="text-[10px] text-[#9ca3af] mt-1">+ {proc.andamentos.length - 1} andamento{proc.andamentos.length > 2 ? 's' : ''} anterior{proc.andamentos.length > 2 ? 'es' : ''}</p>
          )}
        </div>
      )}

      {/* Partes vinculadas */}
      {proc.partes_vinculadas.length > 0 && (
        <div className="px-5 py-3 border-t border-[#f3f4f6]">
          <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2 flex items-center gap-1">
            <Users size={10} /> Partes vinculadas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {proc.partes_vinculadas.map((p, i) => (
              <span key={i} className="text-[11px] text-[#374151] bg-white border border-[#e5e7eb] px-2.5 py-0.5 rounded-lg">{p}</span>
            ))}
          </div>
        </div>
      )}

      {/* Agenda */}
      {(proc.prazos.length + proc.audiencias.length + proc.tarefas.length) > 0 && (
        <div className="px-5 py-3 border-t border-[#f3f4f6]">
          <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2 flex items-center gap-1">
            <CalendarDays size={10} /> Agenda ({proc.prazos.length + proc.audiencias.length + proc.tarefas.length})
          </p>
          <div className="space-y-1">
            {[...proc.audiencias.slice(0, 3), ...proc.prazos.slice(0, 3)].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold',
                  item.tipo === 'audiencia' ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'
                )}>{item.tipo}</span>
                <span className="text-[#374151] truncate flex-1">{item.titulo}</span>
                {item.data && <span className="text-[#9ca3af] shrink-0">{item.data}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Financeiro */}
      {(proc.honorarios.length + proc.custas.length + proc.alvaras.length) > 0 && (
        <div className="px-5 py-3 border-t border-[#f3f4f6]">
          <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1 flex items-center gap-1">
            <Banknote size={10} /> Financeiro
          </p>
          <p className="text-[11px] text-[#9ca3af]">
            {proc.honorarios.length > 0 && `${proc.honorarios.length} receita${proc.honorarios.length > 1 ? 's' : ''}`}
            {proc.custas.length > 0 && ` · ${proc.custas.length} despesa${proc.custas.length > 1 ? 's' : ''}`}
            {proc.alvaras.length > 0 && ` · ${proc.alvaras.length} alvará${proc.alvaras.length > 1 ? 's' : ''}`}
            {' '}(visualizados no preview — não importados)
          </p>
        </div>
      )}

      {/* Campos não encontrados */}
      {proc.campos_nao_encontrados.length > 0 && (
        <div className="px-5 py-3 border-t border-amber-100 bg-amber-50/50">
          <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1">Campos não encontrados no HTML</p>
          <p className="text-[11px] text-amber-700">{proc.campos_nao_encontrados.join(' · ')}</p>
        </div>
      )}
    </div>
  )
}

// ── Primitivos ────────────────────────────────────────────────────────────────

function Metrica({ icon, label, value, cor, bg }: { icon: ReactNode; label: string; value: number; cor: string; bg: string }) {
  return (
    <div className={cn('rounded-xl p-3.5 border border-[#f3f4f6]', bg)}>
      <div className={cn('flex items-center gap-1.5 text-[10px] font-semibold mb-1.5', cor)}>{icon}{label}</div>
      <p className={cn('text-[22px] font-bold tabular-nums leading-none', cor)}>{value}</p>
    </div>
  )
}

function Campo({ label, valor }: { label: string; valor: string | null | undefined }) {
  return (
    <div>
      <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">{label}:</span>{' '}
      <span className={valor ? 'text-[#374151]' : 'text-[#d1d5db]'}>{valor || '—'}</span>
    </div>
  )
}

function AvisoBox({ type, children }: { type: 'erro' | 'aviso'; children: ReactNode }) {
  return (
    <div className={cn(
      'flex items-start gap-2.5 p-3.5 rounded-xl text-[12px] leading-relaxed border',
      type === 'erro' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700',
    )}>
      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  )
}
