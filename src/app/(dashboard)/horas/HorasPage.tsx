'use client'

import { useState } from 'react'
import { Clock3, Download, Loader2, Search } from 'lucide-react'
import SearchableCombobox from '@/components/ui/SearchableCombobox'
import { fetchClienteOptions } from '@/lib/search/remote'
import { formatDurationMinutes } from '@/lib/agenda-time-entries'
import type { RelatorioHoras } from '@/lib/relatorio-horas/dados'

function primeiroDiaDoMes() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function hoje() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function HorasPage() {
  const [clienteId, setClienteId] = useState('')
  const [de, setDe] = useState(primeiroDiaDoMes())
  const [ate, setAte] = useState(hoje())
  const [rel, setRel] = useState<RelatorioHoras | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const query = () => new URLSearchParams({ cliente_id: clienteId, de, ate }).toString()

  async function buscar() {
    if (!clienteId) { setErro('Escolha o cliente.'); return }
    setCarregando(true); setErro('')
    const res = await fetch(`/api/horas?${query()}`)
    setCarregando(false)
    if (!res.ok) { setErro((await res.json().catch(() => ({}))).error ?? 'Não foi possível buscar as horas.'); return }
    setRel(await res.json())
  }

  async function baixarPdf() {
    const res = await fetch(`/api/horas/pdf?${query()}`)
    if (!res.ok) { setErro((await res.json().catch(() => ({}))).error ?? 'Não foi possível gerar o PDF.'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] ?? 'relatorio-horas.pdf'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const inputCls = 'w-full px-3 py-2 text-[13px] bg-white border border-[var(--color-border)] rounded-xl outline-none focus:border-[var(--color-copper)] text-[var(--color-ink)]'
  const labelCls = 'block text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider mb-1.5'

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 sm:px-7 sm:py-6 shadow-[0_18px_48px_rgba(13,34,53,0.06)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-copper)] mb-2">Relatórios</p>
        <h1 className="font-brand text-[34px] font-semibold text-[var(--color-ink)] tracking-tight leading-none flex items-center gap-2">
          <Clock3 size={26} className="text-[var(--color-copper)]" /> Horas por cliente
        </h1>
        <p className="text-[13px] text-[var(--color-ink-3)] mt-2">
          As horas lançadas nos andamentos e na agenda, por cliente e período. O PDF mostra só as horas, para entregar ao cliente.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 grid grid-cols-1 md:grid-cols-[1fr_160px_160px_auto] gap-4 items-end">
        <div>
          <label className={labelCls}>Cliente</label>
          <SearchableCombobox
            value={clienteId}
            onChange={v => { setClienteId(v); setRel(null) }}
            loadOptions={async q => fetchClienteOptions(q, 10)}
            placeholder="Buscar cliente…"
            searchPlaceholder="Buscar por nome ou CNPJ/CPF"
            helperText="Digite ao menos 2 caracteres."
            emptyText="Digite para buscar clientes."
            noResultsText="Nenhum resultado encontrado."
          />
        </div>
        <div><label className={labelCls}>De</label><input type="date" value={de} onChange={e => setDe(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Até</label><input type="date" value={ate} onChange={e => setAte(e.target.value)} className={inputCls} /></div>
        <button onClick={buscar} disabled={carregando} className="flex items-center justify-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-white bg-[var(--color-sidebar)] hover:bg-[var(--color-petrol)] rounded-xl disabled:opacity-60">
          {carregando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Buscar
        </button>
      </div>

      {erro && <p className="text-[13px] text-red-600 bg-red-50 px-4 py-3 rounded-xl">{erro}</p>}

      {rel && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-4 border-b border-[var(--color-border)]">
            <div>
              <p className="text-[15px] font-semibold text-[var(--color-ink)]">{rel.cliente}</p>
              <p className="text-[12px] text-[var(--color-ink-3)]">
                {rel.linhas.length} lançamento{rel.linhas.length !== 1 ? 's' : ''} · <strong className="text-[var(--color-ink)]">{formatDurationMinutes(rel.totalMinutos)}</strong> no período
              </p>
            </div>
            <button onClick={baixarPdf} disabled={rel.linhas.length === 0} className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-white bg-[#1D5F60] hover:bg-[#27777A] rounded-xl disabled:opacity-50">
              <Download size={14} /> Gerar PDF para o cliente
            </button>
          </div>

          {rel.linhas.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-[var(--color-ink-3)]">Nenhuma hora lançada para este cliente no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--color-ink-3)] border-b border-[var(--color-border)]">
                    <th className="px-5 py-2.5 font-semibold">Data</th><th className="px-3 py-2.5 font-semibold">Processo</th>
                    <th className="px-3 py-2.5 font-semibold">Atividade</th><th className="px-3 py-2.5 font-semibold">Quem fez</th>
                    <th className="px-5 py-2.5 font-semibold text-right">Tempo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {rel.linhas.map(l => (
                    <tr key={l.id}>
                      <td className="px-5 py-2.5 whitespace-nowrap">{l.data}</td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-[var(--color-ink-2)]">{l.processo ?? '—'}</td>
                      <td className="px-3 py-2.5">{l.atividade}</td>
                      <td className="px-3 py-2.5 text-[var(--color-ink-2)]">{l.responsavel}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{formatDurationMinutes(l.minutos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rel.porResponsavel.length > 1 && (
            <div className="px-5 py-3 border-t border-[var(--color-border)] text-[12px] text-[var(--color-ink-2)] flex gap-x-5 gap-y-1 flex-wrap">
              {rel.porResponsavel.map(p => <span key={p.nome}>{p.nome}: <strong>{formatDurationMinutes(p.minutos)}</strong></span>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
