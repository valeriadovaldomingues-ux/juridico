'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileSpreadsheet, Loader2, Trash2, Upload, X } from 'lucide-react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import {
  MESES, anosComDespesa, csvDoRelatorio, dataDoLancamento, montarRelatorioDespesas, percentual,
  type LancamentoRelatorio, type LinhaConta,
} from '@/lib/financeiro/relatorio-despesas'

type Filtro = 'todas' | 'pagas'

const num = (v: number) => (v ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—')
const pct = (v: number) => (v ? `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : '')

export default function RelatorioDespesasView({ podeVerReferencia = false }: { podeVerReferencia?: boolean }) {
  const anoAtual = new Date().getFullYear()
  const [ano, setAno] = useState(anoAtual)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [lancamentos, setLancamentos] = useState<LancamentoRelatorio[]>([])
  const [anos, setAnos] = useState<number[]>([anoAtual])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [referencias, setReferencias] = useState<{ arquivo: string; nome: string }[]>([])
  const [enviando, setEnviando] = useState(false)
  const [detalhe, setDetalhe] = useState<{ linha: LinhaConta; mes: number | null } | null>(null)

  const carregar = useCallback(async (a: number) => {
    setCarregando(true)
    setErro('')
    try {
      const res = await fetch(`/api/financeiro/relatorio-despesas?ano=${a}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao carregar')
      setLancamentos(json.lancamentos)
      setAnos(anosComDespesa(json.datas, anoAtual))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setCarregando(false)
    }
  }, [anoAtual])

  const carregarReferencias = useCallback(async () => {
    if (!podeVerReferencia) return
    const res = await fetch('/api/financeiro/relatorio-despesas/referencia')
    if (res.ok) setReferencias((await res.json()).arquivos ?? [])
  }, [podeVerReferencia])

  useEffect(() => {
    carregarReferencias()
  }, [carregarReferencias])

  async function enviarReferencia(file: File | undefined) {
    if (!file) return
    setEnviando(true)
    setErro('')
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/financeiro/relatorio-despesas/referencia', { method: 'POST', body: fd })
    if (!res.ok) setErro((await res.json().catch(() => ({}))).error ?? 'Erro ao guardar a planilha')
    setEnviando(false)
    carregarReferencias()
  }

  async function apagarReferencia(arquivo: string) {
    if (!confirm('Remover esta planilha do relatório?')) return
    await fetch(`/api/financeiro/relatorio-despesas/referencia?arquivo=${encodeURIComponent(arquivo)}`, { method: 'DELETE' })
    carregarReferencias()
  }

  useEffect(() => {
    carregar(ano)
  }, [ano, carregar])

  const relatorio = useMemo(
    () => montarRelatorioDespesas(lancamentos, ano, { apenasPagas: filtro === 'pagas' }),
    [lancamentos, ano, filtro],
  )

  function baixarCsv() {
    const blob = new Blob(['﻿' + csvDoRelatorio(relatorio)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `relatorio-despesas-${ano}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const itensDetalhe = useMemo(() => {
    if (!detalhe) return []
    const { linha, mes } = detalhe
    const lista = mes === null ? linha.itens.flat() : linha.itens[mes]
    return [...lista].sort((a, b) => dataDoLancamento(a).localeCompare(dataDoLancamento(b)))
  }, [detalhe])

  // Base dos percentuais: total de despesas do mês (ou do ano, no acumulado).
  const baseDetalhe = detalhe ? (detalhe.mes === null ? relatorio.totalAno : relatorio.totaisMes[detalhe.mes]) : 0

  const th = 'text-right text-[10px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-2 whitespace-nowrap'
  const td = 'text-right text-[12px] tabular-nums py-2 px-2 whitespace-nowrap'

  return (
    <div className="p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={ano} onChange={e => setAno(Number(e.target.value))}
          className="px-3 py-1.5 text-[12px] bg-white border border-[#e5e7eb] rounded-lg outline-none focus:border-[#1D5F60] text-[#374151]">
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filtro} onChange={e => setFiltro(e.target.value as Filtro)}
          className="px-3 py-1.5 text-[12px] bg-white border border-[#e5e7eb] rounded-lg outline-none focus:border-[#1D5F60] text-[#374151]">
          <option value="todas">Pagas e a pagar</option>
          <option value="pagas">Só as pagas</option>
        </select>
        <p className="text-[11px] text-[#9ca3af]">Cada despesa cai no mês em que foi paga (ou no vencimento, se ainda não foi paga). Clique num valor para ver as despesas.</p>
        <button onClick={baixarCsv} disabled={carregando}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#1D5F60] border border-[#1D5F60]/30 rounded-lg hover:bg-[#f0f7f7] disabled:opacity-50">
          <Download size={13} /> Baixar planilha (CSV)
        </button>
      </div>

      {podeVerReferencia && (
        <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={14} className="text-[#1D5F60]" />
            <p className="text-[12px] font-semibold text-[#374151]">Planilha do contador (subsídio) — só os sócios veem</p>
            <label className="ml-auto flex items-center gap-1.5 px-3 py-1 text-[12px] font-medium text-[#1D5F60] border border-[#1D5F60]/30 rounded-lg hover:bg-[#f0f7f7] cursor-pointer">
              {enviando ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Anexar planilha
              <input type="file" accept=".xls,.xlsx,.csv,.pdf" className="hidden" disabled={enviando}
                onChange={e => { enviarReferencia(e.target.files?.[0]); e.target.value = '' }} />
            </label>
          </div>
          {referencias.length === 0 ? (
            <p className="text-[11px] text-[#9ca3af]">Nenhuma planilha anexada. Anexe a &ldquo;Relatório de despesas com fórmulas&rdquo; do contador para ficar à disposição dos sócios.</p>
          ) : (
            <ul className="space-y-1">
              {referencias.map(r => (
                <li key={r.arquivo} className="flex items-center gap-2 text-[12px]">
                  <a href={`/api/financeiro/relatorio-despesas/referencia?arquivo=${encodeURIComponent(r.arquivo)}`} className="text-[#1D5F60] hover:underline">{r.nome}</a>
                  <button onClick={() => apagarReferencia(r.arquivo)} title="Remover" className="p-1 text-[#c5cdd8] hover:text-red-600"><Trash2 size={12} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {erro && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}

      {carregando ? (
        <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-[#9ca3af]" size={20} /></div>
      ) : (
        <div className="overflow-x-auto border border-[#f3f4f6] rounded-lg">
          <table className="w-full min-w-[1500px]">
            <thead>
              <tr className="bg-[#f9fafb] border-b border-[#f3f4f6]">
                <th className="text-left text-[10px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-3 sticky left-0 bg-[#f9fafb] min-w-[240px]">Conta</th>
                {MESES.map(m => (
                  <th key={m} colSpan={2} className={cn(th, 'text-center')}>{m}</th>
                ))}
                <th colSpan={2} className={cn(th, 'text-center')}>Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {relatorio.linhas.map(l => (
                <tr key={l.chave} className="border-b border-[#f5f7fa] hover:bg-[#fafbfb]">
                  <td className="text-[12px] text-[#374151] py-2 px-3 sticky left-0 bg-white">
                    {l.codigo && <span className="text-[#a8b3c4] mr-1.5">{l.codigo}</span>}{l.nome}
                  </td>
                  {l.meses.map((v, m) => (
                    <FragmentoMes key={m} valor={v} total={relatorio.totaisMes[m]} tdCls={td}
                      onClick={v ? () => setDetalhe({ linha: l, mes: m }) : undefined} />
                  ))}
                  <FragmentoMes valor={l.total} total={relatorio.totalAno} tdCls={cn(td, 'font-semibold')}
                    onClick={l.total ? () => setDetalhe({ linha: l, mes: null }) : undefined} />
                </tr>
              ))}
              <tr className="bg-[#f9fafb] font-bold border-t border-[#e5e7eb]">
                <td className="text-[12px] text-[#0f1923] py-2.5 px-3 sticky left-0 bg-[#f9fafb]">TOTAIS</td>
                {relatorio.totaisMes.map((v, m) => (
                  <td key={m} colSpan={2} className={cn(td, 'text-[#a93226]')}>{num(v)}</td>
                ))}
                <td colSpan={2} className={cn(td, 'text-[#a93226]')}>{num(relatorio.totalAno)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {detalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setDetalhe(null)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f3f4f6]">
              <h2 className="text-[14px] font-semibold text-[#0f1923]">
                {detalhe.linha.nome} · {detalhe.mes === null ? `${ano} (ano todo)` : `${MESES[detalhe.mes]} ${ano}`}
              </h2>
              <button onClick={() => setDetalhe(null)} className="p-1.5 rounded-lg text-[#9ca3af] hover:bg-[#f3f4f6]"><X size={16} /></button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-[#f9fafb] border-b border-[#f3f4f6] text-[10px] uppercase tracking-wider text-[#a8b3c4]">
                  <th className="text-left py-2 px-4">Data</th>
                  <th className="text-left py-2 px-2">Fornecedor</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-right py-2 px-2">% do {detalhe.mes === null ? 'ano' : 'mês'}</th>
                  <th className="text-right py-2 px-4">Valor</th>
                </tr>
              </thead>
              <tbody>
                {itensDetalhe.map(i => (
                  <tr key={i.id} className="border-b border-[#f5f7fa] text-[12px] text-[#374151]">
                    <td className="py-2 px-4 whitespace-nowrap">{formatDate(dataDoLancamento(i))}</td>
                    <td className="py-2 px-2">{i.fornecedor || i.descricao}{i.fornecedor && i.fornecedor !== i.descricao && <span className="block text-[11px] text-[#9ca3af]">{i.descricao}</span>}</td>
                    <td className="py-2 px-2">{i.status === 'pago' ? 'Pago' : 'A pagar'}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-[#9ca3af]">{pct(percentual(Number(i.valor), baseDetalhe))}</td>
                    <td className="py-2 px-4 text-right tabular-nums">{formatCurrency(Number(i.valor))}</td>
                  </tr>
                ))}
                <tr className="font-bold text-[12px]">
                  <td colSpan={3} className="py-2.5 px-4">Total</td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-[#9ca3af]">{pct(percentual(itensDetalhe.reduce((a, i) => a + Number(i.valor), 0), baseDetalhe))}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums">{formatCurrency(itensDetalhe.reduce((a, i) => a + Number(i.valor), 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function FragmentoMes({ valor, total, tdCls, onClick }: { valor: number; total: number; tdCls: string; onClick?: () => void }) {
  return (
    <>
      <td className={cn(tdCls, valor ? 'text-[#374151]' : 'text-[#d1d5db]', onClick && 'cursor-pointer hover:text-[#1D5F60] hover:underline')} onClick={onClick}>{num(valor)}</td>
      <td className="text-right text-[10px] tabular-nums text-[#9ca3af] py-2 pr-2 pl-0 whitespace-nowrap">{pct(percentual(valor, total))}</td>
    </>
  )
}
