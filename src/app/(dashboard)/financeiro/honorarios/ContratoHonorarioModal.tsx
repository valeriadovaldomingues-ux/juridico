'use client'

import { useState } from 'react'
import { X, Plus, Trash2, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import SearchableCombobox, { type SearchableComboboxOption } from '@/components/ui/SearchableCombobox'
import { fetchClienteOptions } from '@/lib/search/remote'
import type { ContratoStatus, HonorarioContrato } from '@/lib/honorarios/types'

interface Props {
  contratos: HonorarioContrato[]
  onClose: () => void
  onChange: (contratos: HonorarioContrato[]) => void
}

const STATUS_OPCOES: { value: ContratoStatus; label: string }[] = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'suspenso', label: 'Suspenso' },
  { value: 'encerrado', label: 'Encerrado' },
]

export default function ContratoHonorarioModal({ contratos, onClose, onChange }: Props) {
  const [clienteId, setClienteId] = useState('')
  const [clienteOpt, setClienteOpt] = useState<SearchableComboboxOption | null>(null)
  const [valor, setValor] = useState('')
  const [dia, setDia] = useState('10')
  const [isento, setIsento] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const adicionar = async () => {
    if (!clienteId) { setErro('Selecione um cliente.'); return }
    setSalvando(true); setErro(null)
    try {
      const res = await fetch('/api/financeiro/honorarios/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteId,
          valor_mensal: Number(valor) || 0,
          dia_vencimento: Number(dia) || 10,
          isento,
        }),
      })
      if (!res.ok) { setErro((await res.json()).error ?? 'Falha ao salvar contrato.'); return }
      const novo: HonorarioContrato = await res.json()
      onChange([novo, ...contratos])
      setClienteId(''); setClienteOpt(null); setValor(''); setDia('10'); setIsento(false)
    } finally { setSalvando(false) }
  }

  const patch = async (id: string, campos: Partial<HonorarioContrato>) => {
    const res = await fetch(`/api/financeiro/honorarios/contratos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campos),
    })
    if (!res.ok) return
    const atualizado: HonorarioContrato = await res.json()
    onChange(contratos.map(c => (c.id === id ? atualizado : c)))
  }

  const excluir = async (id: string) => {
    if (!confirm('Excluir este contrato de honorário?')) return
    const res = await fetch(`/api/financeiro/honorarios/contratos/${id}`, { method: 'DELETE' })
    if (res.ok) onChange(contratos.filter(c => c.id !== id))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#EFEBE6]">
          <h2 className="text-[16px] font-semibold text-[#0f1923]">Contratos de honorário</h2>
          <button onClick={onClose} className="p-1 text-[#7a8899] hover:text-[#0f1923]"><X size={18} /></button>
        </div>

        {/* Adicionar */}
        <div className="px-5 py-4 border-b border-[#EFEBE6] space-y-3 bg-[#F9F7F4]">
          <p className="text-[12px] font-semibold text-[#5a6675] uppercase tracking-wide">Novo contrato</p>
          <SearchableCombobox
            value={clienteId}
            selectedOption={clienteOpt}
            onChange={(v, opt) => { setClienteId(v); setClienteOpt(opt) }}
            loadOptions={fetchClienteOptions}
            placeholder="Selecionar cliente…"
            allowClear
          />
          <div className="flex flex-wrap items-center gap-2">
            <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} placeholder="Valor mensal" className="w-36 text-[13px] border border-[#E2DDD8] rounded-lg px-2 py-1.5 outline-none focus:border-[#1D5F60]" />
            <input type="number" min={1} max={31} value={dia} onChange={e => setDia(e.target.value)} placeholder="Dia venc." className="w-24 text-[13px] border border-[#E2DDD8] rounded-lg px-2 py-1.5 outline-none focus:border-[#1D5F60]" />
            <label className="flex items-center gap-1.5 text-[13px] text-[#5a6675]">
              <input type="checkbox" checked={isento} onChange={e => setIsento(e.target.checked)} /> Isento
            </label>
            <button onClick={adicionar} disabled={salvando} className="inline-flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-lg bg-[#0B1C2D] text-white disabled:opacity-50">
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Adicionar
            </button>
          </div>
          {erro && <p className="text-[12px] text-[#a93226]">{erro}</p>}
        </div>

        {/* Lista */}
        <div className="px-5 py-4 space-y-2">
          {contratos.length === 0 && <p className="text-[13px] text-[#7a8899]">Nenhum contrato cadastrado.</p>}
          {contratos.map(c => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 border border-[#EFEBE6] rounded-lg px-3 py-2">
              <span className="flex-1 min-w-[140px] text-[13px] font-medium text-[#0f1923]">{c.cliente?.nome ?? c.cliente_id}</span>
              <span className="text-[13px] text-[#5a6675]">{c.isento ? 'Isento' : formatCurrency(c.valor_mensal)}</span>
              <span className="text-[12px] text-[#9ca3af]">venc. dia {c.dia_vencimento}</span>
              <select
                value={c.status}
                onChange={e => patch(c.id, { status: e.target.value as ContratoStatus })}
                className="text-[12px] border border-[#E2DDD8] rounded-lg px-2 py-1 outline-none"
              >
                {STATUS_OPCOES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <button onClick={() => excluir(c.id)} className="p-1 text-[#5a6675] hover:text-[#a93226]"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
