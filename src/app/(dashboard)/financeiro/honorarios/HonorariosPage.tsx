'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  ChevronLeft, ChevronRight, FileText, Lock, RefreshCw,
  Search, Settings2, Ban, Loader2, FileDown, FileSpreadsheet, Plus, X,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { addMeses, formatCompetencia, computeDashboard } from '@/lib/honorarios/service'
import {
  HONORARIO_STATUS, HONORARIO_STATUS_LABELS, FORMAS_PAGAMENTO, FORMA_PAGAMENTO_LABELS,
} from '@/lib/honorarios/types'
import type { HonorarioContrato, HonorarioMensal, HonorarioStatus } from '@/lib/honorarios/types'
import ContratoHonorarioModal from './ContratoHonorarioModal'
import ExtraHonorarioModal from './ExtraHonorarioModal'

interface Props {
  competenciaInicial: string
  registrosIniciais: HonorarioMensal[]
  contratosIniciais: HonorarioContrato[]
  fechadoInicial: boolean
}

const STATUS_COR: Record<HonorarioStatus, string> = {
  pago:      'bg-[#e6f4ee] text-[#1a7a45]',
  pendente:  'bg-[#fef8ec] text-[#8a6000]',
  parcial:   'bg-[#eaf1fb] text-[#1c4e9c]',
  em_atraso: 'bg-[#fde8e8] text-[#a93226]',
  isento:    'bg-[#F3F1EE] text-[#7a8899]',
}

function formatDataBR(iso: string | null): string {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return a && m && d ? `${d}/${m}/${a}` : iso
}

export default function HonorariosPage({
  competenciaInicial, registrosIniciais, contratosIniciais, fechadoInicial,
}: Props) {
  const [competencia, setCompetencia] = useState(competenciaInicial)
  const [registros, setRegistros] = useState<HonorarioMensal[]>(registrosIniciais)
  const [contratos, setContratos] = useState<HonorarioContrato[]>(contratosIniciais)
  const [fechado, setFechado] = useState(fechadoInicial)
  const [carregando, setCarregando] = useState(false)
  const [acao, setAcao] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [contratosAberto, setContratosAberto] = useState(false)
  const [extraAberto, setExtraAberto] = useState(false)

  const [pergunta, setPergunta] = useState('')
  const [consulta, setConsulta] = useState<{ titulo: string; registros: HonorarioMensal[] } | null>(null)

  // Filtros
  const [fCliente, setFCliente] = useState('')
  const [fStatus, setFStatus] = useState<'' | HonorarioStatus>('')
  const [fResponsavel, setFResponsavel] = useState('')
  const [fPendentes, setFPendentes] = useState(false)

  const dashboard = useMemo(() => computeDashboard(registros), [registros])
  const clientesAtivos = useMemo(() => contratos.filter(c => c.status === 'ativo').length, [contratos])
  const responsaveis = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of registros) if (r.responsavel) map.set(r.responsavel.id, r.responsavel.nome)
    return [...map.entries()]
  }, [registros])

  const carregar = useCallback(async (comp: string) => {
    setCarregando(true); setErro(null); setConsulta(null)
    try {
      const [rReg, rCtr] = await Promise.all([
        fetch(`/api/financeiro/honorarios?competencia=${comp.slice(0, 7)}`),
        fetch(`/api/financeiro/honorarios/contratos`),
      ])
      const reg = await rReg.json()
      setRegistros(reg.registros ?? [])
      setFechado(!!reg.fechado)
      const ctr = await rCtr.json()
      setContratos(ctr.contratos ?? [])
    } catch {
      setErro('Falha ao carregar a competência.')
    } finally {
      setCarregando(false)
    }
  }, [])

  const navegarMes = useCallback(async (delta: number) => {
    const nova = addMeses(competencia, delta)
    setCompetencia(nova)
    await carregar(nova)
  }, [competencia, carregar])

  const patchRegistro = useCallback(async (id: string, patch: Partial<HonorarioMensal>) => {
    setErro(null)
    const res = await fetch(`/api/financeiro/honorarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) { setErro((await res.json()).error ?? 'Não foi possível salvar a alteração.'); return }
    const atualizado: HonorarioMensal = await res.json()
    setRegistros(prev => prev.map(r => (r.id === id ? atualizado : r)))
  }, [])

  const cancelarRegistro = useCallback(async (id: string) => {
    if (!confirm('Cancelar este lançamento? (não é excluído — fica no histórico/auditoria)')) return
    const res = await fetch(`/api/financeiro/honorarios/${id}/cancelar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
    if (!res.ok) { setErro((await res.json()).error ?? 'Falha ao cancelar.'); return }
    const atualizado: HonorarioMensal = await res.json()
    setRegistros(prev => prev.map(r => (r.id === id ? atualizado : r)))
  }, [])

  const gerarMes = useCallback(async () => {
    setAcao('gerar'); setErro(null)
    try {
      const res = await fetch('/api/financeiro/honorarios/gerar-mes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competencia: competencia.slice(0, 7) }),
      })
      if (!res.ok) { setErro((await res.json()).error ?? 'Falha ao gerar o mês.'); return }
      await carregar(competencia)
    } finally { setAcao(null) }
  }, [competencia, carregar])

  const fecharMes = useCallback(async () => {
    if (!confirm(`Fechar ${formatCompetencia(competencia)}? Consolida o mês (congela para histórico) e gera as pendências do mês seguinte.`)) return
    setAcao('fechar'); setErro(null)
    try {
      const res = await fetch('/api/financeiro/honorarios/fechar-mes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competencia: competencia.slice(0, 7) }),
      })
      if (!res.ok) { setErro((await res.json()).error ?? 'Falha ao fechar o mês.'); return }
      setFechado(true)
    } finally { setAcao(null) }
  }, [competencia])

  const rodarConsulta = useCallback(async () => {
    setAcao('consulta'); setErro(null)
    try {
      const res = await fetch(`/api/financeiro/honorarios/consulta?competencia=${competencia.slice(0, 7)}&q=${encodeURIComponent(pergunta)}`)
      const data = await res.json()
      setConsulta({ titulo: data.titulo, registros: data.registros ?? [] })
    } finally { setAcao(null) }
  }, [competencia, pergunta])

  const mes7 = competencia.slice(0, 7)
  const abrirPdfMensal = () => window.open(`/api/financeiro/honorarios/relatorio-mensal/pdf?competencia=${mes7}`, '_blank', 'noopener,noreferrer')
  const abrirXlsxMensal = () => window.open(`/api/financeiro/honorarios/relatorio-mensal/xlsx?competencia=${mes7}`, '_blank', 'noopener,noreferrer')
  const abrirPdfInadimplencia = (clienteId: string) => window.open(`/api/financeiro/honorarios/inadimplencia/pdf?cliente_id=${clienteId}`, '_blank', 'noopener,noreferrer')

  const base = consulta ? consulta.registros : registros
  const lista = useMemo(() => base.filter(r => {
    if (fStatus && r.status !== fStatus) return false
    if (fResponsavel && r.responsavel_lancamento_id !== fResponsavel) return false
    if (fPendentes && !(r.saldo_pendente > 0 && !r.cancelado)) return false
    if (fCliente && !(r.cliente?.nome ?? '').toLowerCase().includes(fCliente.toLowerCase())) return false
    return true
  }), [base, fStatus, fResponsavel, fPendentes, fCliente])

  const editavel = !fechado

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight">Controle de Honorários</h1>
          <p className="text-[13px] text-[#7a8899] mt-0.5">Dashboard e controle mensal de pagamentos por cliente</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navegarMes(-1)} className="p-2 rounded-lg border border-[#E2DDD8] hover:bg-[#F3F1EE]" aria-label="Mês anterior"><ChevronLeft size={16} /></button>
          <span className="min-w-[130px] text-center text-[14px] font-semibold text-[#0f1923]">{formatCompetencia(competencia)}{fechado && <span className="ml-1 text-[10px] text-[#a93226]">(fechado)</span>}</span>
          <button onClick={() => navegarMes(1)} className="p-2 rounded-lg border border-[#E2DDD8] hover:bg-[#F3F1EE]" aria-label="Próximo mês"><ChevronRight size={16} /></button>
          {carregando && <Loader2 size={16} className="animate-spin text-[#7a8899]" />}
        </div>
      </div>

      {/* Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <Card label="Previsto" value={formatCurrency(dashboard.previsto)} />
        <Card label="Recebido" value={formatCurrency(dashboard.recebido)} tone="green" />
        <Card label="Pendente" value={formatCurrency(dashboard.pendente)} tone="red" />
        <Card label="Em atraso" value={formatCurrency(dashboard.emAtraso)} tone="red" />
        <Card label="Adimplência" value={`${dashboard.adimplenciaPct}%`} tone={dashboard.adimplenciaPct >= 80 ? 'green' : undefined} />
        <Card label="Clientes ativos" value={`${clientesAtivos}`} />
        <Card label="Inadimplentes" value={`${dashboard.clientesInadimplentes}`} tone={dashboard.clientesInadimplentes ? 'red' : undefined} />
      </div>

      {/* Ações */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={gerarMes} disabled={acao !== null} className="inline-flex items-center gap-1.5 text-[13px] px-3 py-2 rounded-lg border border-[#E2DDD8] hover:bg-[#F3F1EE] disabled:opacity-50"><RefreshCw size={14} /> Gerar mês</button>
        <button onClick={fecharMes} disabled={acao !== null || fechado} className="inline-flex items-center gap-1.5 text-[13px] px-3 py-2 rounded-lg border border-[#E2DDD8] hover:bg-[#F3F1EE] disabled:opacity-50"><Lock size={14} /> {fechado ? 'Mês fechado' : 'Fechar mês'}</button>
        <button onClick={() => setExtraAberto(true)} className="inline-flex items-center gap-1.5 text-[13px] px-3 py-2 rounded-lg border border-[#E2DDD8] hover:bg-[#F3F1EE]"><Plus size={14} /> Honorário extra</button>
        <button onClick={abrirPdfMensal} className="inline-flex items-center gap-1.5 text-[13px] px-3 py-2 rounded-lg border border-[#E2DDD8] hover:bg-[#F3F1EE]"><FileText size={14} /> PDF</button>
        <button onClick={abrirXlsxMensal} className="inline-flex items-center gap-1.5 text-[13px] px-3 py-2 rounded-lg border border-[#E2DDD8] hover:bg-[#F3F1EE]"><FileSpreadsheet size={14} /> Excel</button>
        <button onClick={() => setContratosAberto(true)} className="inline-flex items-center gap-1.5 text-[13px] px-3 py-2 rounded-lg border border-[#E2DDD8] hover:bg-[#F3F1EE]"><Settings2 size={14} /> Contratos ({clientesAtivos})</button>
      </div>

      {erro && <div className="text-[13px] text-[#a93226] bg-[#fde8e8] border border-[#f5cccc] rounded-lg px-3 py-2">{erro}</div>}

      {/* Consulta rápida */}
      <div className="flex flex-wrap items-center gap-2 bg-[#F9F7F4] border border-[#E2DDD8] rounded-lg px-3 py-2.5">
        <Search size={15} className="text-[#7a8899]" />
        <input value={pergunta} onChange={e => setPergunta(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') rodarConsulta() }}
          placeholder="Pergunte: quais clientes estão devendo? quem está em dia?"
          className="flex-1 min-w-[220px] bg-transparent text-[13px] outline-none" />
        <button onClick={rodarConsulta} disabled={acao === 'consulta'} className="text-[13px] px-3 py-1.5 rounded-lg bg-[#0B1C2D] text-white disabled:opacity-50">Consultar</button>
        {consulta && (<>
          <span className="text-[12px] text-[#1D5F60] font-medium">{consulta.titulo}: {consulta.registros.length}</span>
          <button onClick={() => setConsulta(null)} className="text-[12px] text-[#7a8899] underline">limpar</button>
          <button onClick={abrirPdfMensal} className="inline-flex items-center gap-1 text-[12px] text-[#1c4e9c]"><FileDown size={13} /> PDF do mês</button>
        </>)}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <input value={fCliente} onChange={e => setFCliente(e.target.value)} placeholder="Filtrar cliente…" className="border border-[#E2DDD8] rounded-lg px-2 py-1.5 outline-none focus:border-[#1D5F60]" />
        <select value={fStatus} onChange={e => setFStatus(e.target.value as '' | HonorarioStatus)} className="border border-[#E2DDD8] rounded-lg px-2 py-1.5 outline-none">
          <option value="">Todos os status</option>
          {HONORARIO_STATUS.map(s => <option key={s} value={s}>{HONORARIO_STATUS_LABELS[s]}</option>)}
        </select>
        <select value={fResponsavel} onChange={e => setFResponsavel(e.target.value)} className="border border-[#E2DDD8] rounded-lg px-2 py-1.5 outline-none">
          <option value="">Todos responsáveis</option>
          {responsaveis.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[#5a6675]"><input type="checkbox" checked={fPendentes} onChange={e => setFPendentes(e.target.checked)} /> Só pendentes</label>
        {(fCliente || fStatus || fResponsavel || fPendentes) && (
          <button onClick={() => { setFCliente(''); setFStatus(''); setFResponsavel(''); setFPendentes(false) }} className="inline-flex items-center gap-1 text-[12px] text-[#7a8899] underline"><X size={12} /> limpar filtros</button>
        )}
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto border border-[#E2DDD8] rounded-lg">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-[#F3F1EE] text-[#5a6675] text-left text-[11px] uppercase tracking-wide">
              <th className="px-3 py-2 font-semibold">Cliente</th>
              <th className="px-3 py-2 font-semibold">Vencimento</th>
              <th className="px-3 py-2 font-semibold text-right">Devido</th>
              <th className="px-3 py-2 font-semibold text-right">Pago</th>
              <th className="px-3 py-2 font-semibold text-right">Saldo</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Forma</th>
              <th className="px-3 py-2 font-semibold">Observações</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {lista.map(r => (
              <tr key={r.id} className={`border-t border-[#EFEBE6] hover:bg-[#FAF8F5] ${r.cancelado ? 'opacity-45 line-through' : ''}`}>
                <td className="px-3 py-2 font-medium text-[#0f1923]">
                  {r.cliente?.nome ?? '—'}
                  {r.tipo === 'extra' && <span className="ml-1.5 text-[10px] font-semibold text-[#1c4e9c] bg-[#eaf1fb] px-1.5 py-0.5 rounded-full no-underline">Extra {r.parcela_num}/{r.parcela_total}</span>}
                </td>
                <td className="px-3 py-2 text-[#5a6675]">{formatDataBR(r.vencimento)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(r.valor_devido + r.saldo_anterior)}</td>
                <td className="px-3 py-2 text-right">
                  <input type="number" step="0.01" defaultValue={r.valor_pago} disabled={!editavel || r.cancelado}
                    onBlur={e => { const v = Number(e.target.value); if (v !== r.valor_pago) patchRegistro(r.id, { valor_pago: v }) }}
                    className="w-24 text-right bg-transparent border border-transparent hover:border-[#E2DDD8] focus:border-[#1D5F60] rounded px-1 py-0.5 outline-none disabled:opacity-60" />
                </td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(r.saldo_pendente)}</td>
                <td className="px-3 py-2">
                  <select value={r.status} disabled={!editavel || r.cancelado} onChange={e => patchRegistro(r.id, { status: e.target.value as HonorarioStatus })}
                    className={`text-[12px] font-medium rounded-full px-2 py-1 outline-none cursor-pointer disabled:cursor-default ${STATUS_COR[r.status]}`}>
                    {HONORARIO_STATUS.map(s => <option key={s} value={s}>{HONORARIO_STATUS_LABELS[s]}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select value={r.forma_pagamento ?? ''} disabled={!editavel || r.cancelado} onChange={e => patchRegistro(r.id, { forma_pagamento: e.target.value || null })}
                    className="text-[12px] bg-transparent border border-transparent hover:border-[#E2DDD8] rounded px-1 py-0.5 outline-none disabled:opacity-60">
                    <option value="">—</option>
                    {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{FORMA_PAGAMENTO_LABELS[f]}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input type="text" defaultValue={r.observacoes ?? ''} disabled={!editavel || r.cancelado}
                    onBlur={e => { const v = e.target.value.trim(); if (v !== (r.observacoes ?? '')) patchRegistro(r.id, { observacoes: v || null }) }}
                    placeholder="—" className="w-40 bg-transparent border border-transparent hover:border-[#E2DDD8] focus:border-[#1D5F60] rounded px-1 py-0.5 outline-none disabled:opacity-60" />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 no-underline">
                    <button onClick={() => abrirPdfInadimplencia(r.cliente_id)} title="Histórico 24 meses (PDF)" className="p-1 text-[#5a6675] hover:text-[#1c4e9c]"><FileDown size={14} /></button>
                    {!r.cancelado && editavel && (
                      <button onClick={() => cancelarRegistro(r.id)} title="Cancelar (não exclui)" className="p-1 text-[#5a6675] hover:text-[#a93226]"><Ban size={14} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-[#7a8899]">
                Nenhum registro. Cadastre contratos e clique em <strong>Gerar mês</strong>, ou adicione um <strong>Honorário extra</strong>.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {contratosAberto && <ContratoHonorarioModal contratos={contratos} onClose={() => setContratosAberto(false)} onChange={setContratos} />}
      {extraAberto && <ExtraHonorarioModal competencia={competencia} onClose={() => setExtraAberto(false)} onCreated={() => { setExtraAberto(false); carregar(competencia) }} />}
    </div>
  )
}

function Card({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-[#1a7a45]' : tone === 'red' ? 'text-[#a93226]' : 'text-[#0f1923]'
  return (
    <div className="bg-white border border-[#E2DDD8] rounded-lg px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-[#7a8899]">{label}</p>
      <p className={`text-[16px] font-semibold mt-0.5 ${color}`}>{value}</p>
    </div>
  )
}
