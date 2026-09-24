'use client'

import { useMemo, useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import SearchableCombobox from '@/components/ui/SearchableCombobox'
import { fetchClienteOptions } from '@/lib/search/remote'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type StatusGrade = 'pendente' | 'pago' | 'vencido'
export type FormaPagamento = 'pix' | 'boleto' | 'deposito' | 'escritorio' | 'outro'

export interface ItemGrade {
  id:              string
  cliente_id:      string
  valor_mensal:    number | null
  forma_pagamento: FormaPagamento | null
  status:          StatusGrade
  cliente:         { id: string; nome: string } | null
}

interface Props {
  itens: ItemGrade[]
  podeExcluir: boolean
}

// ─── Config ──────────────────────────────────────────────────────────────────

// Ciclo do clique: pendente → pago → vencido → pendente
const PROXIMO_STATUS: Record<StatusGrade, StatusGrade> = {
  pendente: 'pago',
  pago:     'vencido',
  vencido:  'pendente',
}

const STATUS_CFG: Record<StatusGrade, { label: string; bg: string; text: string; border: string }> = {
  pendente: { label: 'Pendente', bg: 'bg-[#fef8ec]', text: 'text-[#8a6000]', border: 'border-[#f5e6b8]' },
  pago:     { label: 'Pago',     bg: 'bg-[#e6f4ee]', text: 'text-[#1a7a45]', border: 'border-[#b8dfc9]' },
  vencido:  { label: 'Vencido',  bg: 'bg-[#fde8e8]', text: 'text-[#a93226]', border: 'border-[#f5c6c6]' },
}

const FORMA_LABEL: Record<FormaPagamento, string> = {
  pix: 'Pix', boleto: 'Boleto', deposito: 'Depósito', escritorio: 'Escritório', outro: 'Outro',
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function GradePagamentoView({ itens: inicial, podeExcluir }: Props) {
  const [itens, setItens] = useState<ItemGrade[]>(inicial)
  const [busca, setBusca] = useState('')
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [adicionando, setAdicionando] = useState(false)
  const [novoClienteId, setNovoClienteId] = useState('')

  const filtrados = useMemo(() => {
    if (!busca) return itens
    const q = busca.toLowerCase()
    return itens.filter(i => (i.cliente?.nome ?? '').toLowerCase().includes(q))
  }, [itens, busca])

  const resumo = useMemo(() => {
    const total   = itens.reduce((s, i) => s + (i.valor_mensal ?? 0), 0)
    const pago    = itens.filter(i => i.status === 'pago').reduce((s, i) => s + (i.valor_mensal ?? 0), 0)
    const pendente= itens.filter(i => i.status === 'pendente').reduce((s, i) => s + (i.valor_mensal ?? 0), 0)
    const vencido = itens.filter(i => i.status === 'vencido').reduce((s, i) => s + (i.valor_mensal ?? 0), 0)
    return { total, pago, pendente, vencido }
  }, [itens])

  async function patch(item: ItemGrade, body: Record<string, unknown>) {
    setSalvandoId(item.id)
    const res = await fetch(`/api/financeiro/grade-pagamento/${item.id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    setSalvandoId(null)
    if (res.ok) {
      const updated = await res.json()
      setItens(prev => prev.map(i => i.id === item.id ? updated : i))
    }
  }

  function ciclarStatus(item: ItemGrade) {
    patch(item, { status: PROXIMO_STATUS[item.status] })
  }

  async function excluir(item: ItemGrade) {
    if (!confirm(`Remover ${item.cliente?.nome ?? 'este cliente'} da grade?`)) return
    const res = await fetch(`/api/financeiro/grade-pagamento/${item.id}`, { method: 'DELETE' })
    if (res.ok) setItens(prev => prev.filter(i => i.id !== item.id))
  }

  async function adicionarCliente() {
    if (!novoClienteId) return
    const res = await fetch('/api/financeiro/grade-pagamento', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ cliente_id: novoClienteId }),
    })
    if (res.ok) {
      const novo = await res.json()
      setItens(prev => [...prev, novo])
      setNovoClienteId('')
      setAdicionando(false)
    }
  }

  const inputCls = 'px-2.5 py-1.5 text-[12px] bg-[#f9fafb] border border-[#e5e7eb] rounded-lg outline-none focus:bg-white focus:border-[#1D5F60] text-[#1a1d23]'

  return (
    <div className="p-6 space-y-5">
      {/* Resumo */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#f9fafb] rounded-xl p-4 border border-[#f3f4f6] text-center">
          <p className="text-[11px] text-[#9ca3af] mb-1">Total mensal</p>
          <p className="text-[18px] font-bold text-[#0f1923]">{formatCurrency(resumo.total)}</p>
        </div>
        <div className="bg-[#e6f4ee] rounded-xl p-4 border border-[#b8dfc9] text-center">
          <p className="text-[11px] text-[#1a7a45]/70 mb-1">Pago</p>
          <p className="text-[18px] font-bold text-[#1a7a45]">{formatCurrency(resumo.pago)}</p>
        </div>
        <div className="bg-[#fef8ec] rounded-xl p-4 border border-[#f5e6b8] text-center">
          <p className="text-[11px] text-[#8a6000]/70 mb-1">Pendente</p>
          <p className="text-[18px] font-bold text-[#8a6000]">{formatCurrency(resumo.pendente)}</p>
        </div>
        <div className="bg-[#fde8e8] rounded-xl p-4 border border-[#f5c6c6] text-center">
          <p className="text-[11px] text-[#a93226]/70 mb-1">Vencido</p>
          <p className="text-[18px] font-bold text-[#a93226]">{formatCurrency(resumo.vencido)}</p>
        </div>
      </div>

      <p className="text-[11px] text-[#9ca3af]">
        Clique no status pra alternar entre Pendente → Pago → Vencido.
      </p>

      {/* Filtros + adicionar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c5cdd8]" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar cliente…"
            className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-white border border-[#e5e7eb] rounded-lg outline-none focus:border-[#1D5F60] text-[#374151] placeholder:text-[#c5cdd8]"
          />
        </div>
        <span className="text-[11px] text-[#9ca3af]">{filtrados.length} clientes</span>
        <div className="ml-auto flex items-center gap-2">
          {adicionando && (
            <div className="w-72">
              <SearchableCombobox
                value={novoClienteId}
                onChange={value => setNovoClienteId(value)}
                loadOptions={async (query) => fetchClienteOptions(query, 10)}
                placeholder="Buscar cliente…"
                searchPlaceholder="Buscar cliente por nome"
                helperText="Digite ao menos 2 caracteres."
                emptyText="Digite para buscar clientes."
                noResultsText="Nenhum resultado encontrado."
                allowClear
              />
            </div>
          )}
          {adicionando && novoClienteId && (
            <button onClick={adicionarCliente} className="px-3 py-1.5 text-[12px] font-semibold bg-[#1D5F60] hover:bg-[#27777A] text-white rounded-lg transition-colors">
              Adicionar
            </button>
          )}
          <button
            onClick={() => setAdicionando(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#1D5F60] border border-[#145A5B]/30 rounded-lg hover:bg-[#E8F2F2] transition-colors"
          >
            <Plus size={13} /> {adicionando ? 'Cancelar' : 'Adicionar cliente'}
          </button>
        </div>
      </div>

      {/* Grade */}
      <div className="rounded-xl border border-[#f3f4f6] overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-[#f9fafb] border-b border-[#f3f4f6]">
            <th className="text-left  text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Cliente</th>
            <th className="text-right text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4 w-36">Valor mensal</th>
            <th className="text-left  text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4 w-40">Forma de pagamento</th>
            <th className="text-left  text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4 w-32">Status</th>
            <th className="w-10"></th>
          </tr></thead>
          <tbody>
            {filtrados.map(item => {
              const cfg = STATUS_CFG[item.status]
              return (
                <tr key={item.id} className="border-b border-[#f9fafb] last:border-0 hover:bg-[#fafbfb]">
                  <td className="px-4 py-2.5 text-[13px] text-[#374151]">{item.cliente?.nome ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number" step="0.01" min="0"
                      defaultValue={item.valor_mensal ?? ''}
                      onBlur={e => {
                        const v = e.target.value === '' ? null : Number(e.target.value)
                        if (v !== item.valor_mensal) patch(item, { valor_mensal: v })
                      }}
                      className={cn(inputCls, 'w-full text-right')}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={item.forma_pagamento ?? 'boleto'}
                      onChange={e => patch(item, { forma_pagamento: e.target.value })}
                      className={cn(inputCls, 'w-full')}
                    >
                      {Object.entries(FORMA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => ciclarStatus(item)}
                      disabled={salvandoId === item.id}
                      title="Clique para alternar o status"
                      className={cn(
                        'w-full px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition-all disabled:opacity-50',
                        cfg.bg, cfg.text, cfg.border,
                      )}
                    >
                      {cfg.label}
                    </button>
                  </td>
                  <td className="px-2 py-2.5">
                    {podeExcluir && (
                      <button onClick={() => excluir(item)} title="Remover da grade"
                        className="p-1.5 rounded-lg text-[#c5cdd8] hover:text-[#a93226] hover:bg-[#fde8e8] transition-colors">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtrados.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[12px] text-[#9ca3af]">Nenhum cliente encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
