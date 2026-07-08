'use client'

import { useState } from 'react'
import { X, Loader2, Plus } from 'lucide-react'
import SearchableCombobox, { type SearchableComboboxOption } from '@/components/ui/SearchableCombobox'
import { fetchClienteOptions } from '@/lib/search/remote'
import { FORMAS_PAGAMENTO, FORMA_PAGAMENTO_LABELS } from '@/lib/honorarios/types'

interface Props {
  competencia: string          // 'YYYY-MM-01' — sugerida como 1ª competência
  onClose: () => void
  onCreated: () => void
}

export default function ExtraHonorarioModal({ competencia, onClose, onCreated }: Props) {
  const [clienteId, setClienteId] = useState('')
  const [clienteOpt, setClienteOpt] = useState<SearchableComboboxOption | null>(null)
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [parcelas, setParcelas] = useState('1')
  const [dia, setDia] = useState('10')
  const [forma, setForma] = useState('')
  const [primeira, setPrimeira] = useState(competencia.slice(0, 7))
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const salvar = async () => {
    if (!clienteId) { setErro('Selecione um cliente.'); return }
    if (!descricao.trim()) { setErro('Informe a descrição.'); return }
    if (!valor) { setErro('Informe o valor total.'); return }
    setSalvando(true); setErro(null)
    try {
      const res = await fetch('/api/financeiro/honorarios/extras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteId,
          descricao: descricao.trim(),
          valor_total: Number(valor) || 0,
          num_parcelas: Number(parcelas) || 1,
          dia_vencimento: Number(dia) || 10,
          forma_pagamento: forma || null,
          primeira_competencia: primeira,
          observacoes: obs.trim() || null,
        }),
      })
      if (!res.ok) { setErro((await res.json()).error ?? 'Falha ao criar honorário extra.'); return }
      onCreated()
    } finally { setSalvando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#EFEBE6]">
          <h2 className="text-[16px] font-semibold text-[#0f1923]">Novo honorário extra / isolado</h2>
          <button onClick={onClose} className="p-1 text-[#7a8899] hover:text-[#0f1923]"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <SearchableCombobox
            value={clienteId}
            selectedOption={clienteOpt}
            onChange={(v, opt) => { setClienteId(v); setClienteOpt(opt) }}
            loadOptions={fetchClienteOptions}
            placeholder="Selecionar cliente…"
            allowClear
          />
          <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição (ex.: honorário de êxito, contrato isolado)"
            className="w-full text-[13px] border border-[#E2DDD8] rounded-lg px-2.5 py-2 outline-none focus:border-[#1D5F60]" />
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1 text-[12px] text-[#5a6675]">Valor total
              <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} className="w-36 text-[13px] border border-[#E2DDD8] rounded-lg px-2 py-1.5 outline-none focus:border-[#1D5F60]" />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-[#5a6675]">Parcelas
              <input type="number" min={1} max={60} value={parcelas} onChange={e => setParcelas(e.target.value)} className="w-24 text-[13px] border border-[#E2DDD8] rounded-lg px-2 py-1.5 outline-none focus:border-[#1D5F60]" />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-[#5a6675]">Dia venc.
              <input type="number" min={1} max={31} value={dia} onChange={e => setDia(e.target.value)} className="w-20 text-[13px] border border-[#E2DDD8] rounded-lg px-2 py-1.5 outline-none focus:border-[#1D5F60]" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1 text-[12px] text-[#5a6675]">1ª competência
              <input type="month" value={primeira} onChange={e => setPrimeira(e.target.value)} className="text-[13px] border border-[#E2DDD8] rounded-lg px-2 py-1.5 outline-none focus:border-[#1D5F60]" />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-[#5a6675]">Forma
              <select value={forma} onChange={e => setForma(e.target.value)} className="text-[13px] border border-[#E2DDD8] rounded-lg px-2 py-1.5 outline-none">
                <option value="">—</option>
                {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{FORMA_PAGAMENTO_LABELS[f]}</option>)}
              </select>
            </label>
          </div>
          <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Observações (opcional)"
            className="w-full text-[13px] border border-[#E2DDD8] rounded-lg px-2.5 py-2 outline-none focus:border-[#1D5F60]" />
          {erro && <p className="text-[12px] text-[#a93226]">{erro}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#EFEBE6]">
          <button onClick={onClose} className="text-[13px] px-3 py-2 rounded-lg border border-[#E2DDD8] hover:bg-[#F3F1EE]">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="inline-flex items-center gap-1.5 text-[13px] px-3 py-2 rounded-lg bg-[#0B1C2D] text-white disabled:opacity-50">
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Criar honorário extra
          </button>
        </div>
      </div>
    </div>
  )
}
