'use client'

import { useMemo, useState } from 'react'
import {
  Plus, TrendingDown, AlertCircle, CheckCircle2,
  Pencil, Trash2, Search, Wallet,
} from 'lucide-react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import SearchableCombobox from '@/components/ui/SearchableCombobox'
import { fetchClienteOptions } from '@/lib/search/remote'
import LancamentoModal from '../LancamentoModal'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Despesa {
  id:           string
  tipo:         'despesa'
  categoria:    string
  descricao:    string
  valor:        number
  vencimento:   string
  pagamento_em: string | null
  status:       'pendente' | 'pago' | 'vencido' | 'cancelado'
  cliente_id:   string | null
  processo_id:  string | null
  centro_custo: string | null
  created_at:   string
  cliente:  { id: string; nome: string } | null
  processo: { id: string; numero_processo: string | null; titulo: string } | null
}

interface Props {
  despesas:  Despesa[]
  podeExcluir: boolean
}

const statusCfg: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  pendente:  { bg: 'bg-[#fef8ec]', text: 'text-[#8a6000]', dot: 'bg-amber-400',  label: 'Pendente'  },
  pago:      { bg: 'bg-[#e6f4ee]', text: 'text-[#1a7a45]', dot: 'bg-[#2ecc71]',  label: 'Pago'      },
  vencido:   { bg: 'bg-[#fde8e8]', text: 'text-[#a93226]', dot: 'bg-[#e74c3c]',  label: 'Vencido'   },
  cancelado: { bg: 'bg-[#F3F1EE]', text: 'text-[#7a8899]', dot: 'bg-[#c5cdd8]',  label: 'Cancelado' },
}

const PERIODOS = [
  { value: 'todos',        label: 'Todo o período'  },
  { value: 'este-mes',     label: 'Este mês'        },
  { value: 'mes-anterior', label: 'Mês anterior'    },
  { value: 'trimestre',    label: 'Últimos 3 meses' },
  { value: 'ano',          label: 'Este ano'        },
]

function filtrarPorPeriodo(vencimento: string, periodo: string): boolean {
  const hoje = new Date()
  const data  = new Date(vencimento + 'T12:00:00')
  switch (periodo) {
    case 'todos': return true
    case 'este-mes':
      return data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear()
    case 'mes-anterior': {
      const mesAnt = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
      return data.getMonth() === mesAnt.getMonth() && data.getFullYear() === mesAnt.getFullYear()
    }
    case 'trimestre': {
      const corte = new Date(hoje)
      corte.setMonth(hoje.getMonth() - 3)
      return data >= corte
    }
    case 'ano':
      return data.getFullYear() === hoje.getFullYear()
    default: return true
  }
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function DespesasPage({ despesas: inicial, podeExcluir }: Props) {
  const [despesas,    setDespesas]    = useState<Despesa[]>(inicial)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando,    setEditando]    = useState<Despesa | null>(null)
  const [excluindo,   setExcluindo]   = useState<string | null>(null)

  const [busca,       setBusca]       = useState('')
  const [periodo,     setPeriodo]     = useState('este-mes')
  const [filtStatus,  setFiltStatus]  = useState('')
  const [filtCliente, setFiltCliente] = useState('')

  const agora = new Date()
  const hoje = agora.toISOString().slice(0, 10)
  const em7Dias = new Date(agora.getTime() + 7 * 86_400_000).toISOString().slice(0, 10)

  // ── Boletos não pagos (vencidos ou vencendo nos próximos 7 dias) ───────────
  const boletosNaoPagos = useMemo(() => {
    return despesas
      .filter(d => ['pendente', 'vencido'].includes(d.status) && d.vencimento <= em7Dias)
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  }, [despesas, em7Dias])

  const filtrados = useMemo(() => {
    return despesas.filter(d => {
      if (filtStatus  && d.status !== filtStatus)      return false
      if (filtCliente && d.cliente_id !== filtCliente) return false
      if (busca && !d.descricao.toLowerCase().includes(busca.toLowerCase()) && !(d.categoria ?? '').toLowerCase().includes(busca.toLowerCase())) return false
      if (!filtrarPorPeriodo(d.vencimento, periodo)) return false
      return true
    })
  }, [despesas, filtStatus, filtCliente, busca, periodo])

  const metricas = useMemo(() => {
    const total    = despesas.reduce((s, d) => s + d.valor, 0)
    const pago     = despesas.filter(d => d.status === 'pago').reduce((s, d) => s + d.valor, 0)
    const pendente = despesas.filter(d => d.status === 'pendente').reduce((s, d) => s + d.valor, 0)
    const vencido  = despesas.filter(d => d.status === 'vencido').reduce((s, d) => s + d.valor, 0)
    return { total, pago, pendente, vencido }
  }, [despesas])

  function abrirNovo() { setEditando(null); setModalAberto(true) }
  function abrirEdicao(d: Despesa) { setEditando(d); setModalAberto(true) }
  function fecharModal() { setModalAberto(false); setEditando(null) }

  async function handleSalvar(form: any): Promise<string | null> {
    const payload = {
      tipo:         'despesa',
      categoria:    form.categoria,
      descricao:    form.descricao,
      valor:        parseFloat(form.valor),
      vencimento:   form.vencimento,
      pagamento_em: form.pagamento_em || null,
      cliente_id:   form.cliente_id  || null,
      processo_id:  form.processo_id || null,
      status:       form.status,
      centro_custo: form.centro_custo || null,
    }

    if (editando) {
      const res = await fetch(`/api/financeiro/${editando.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return err.error ?? 'Erro ao salvar'
      }
      const updated = await res.json()
      setDespesas(prev => prev.map(d => d.id === editando.id ? updated : d))
    } else {
      const res = await fetch('/api/financeiro', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return err.error ?? 'Erro ao criar'
      }
      const novo = await res.json()
      setDespesas(prev => [novo, ...prev])
    }

    fecharModal()
    return null
  }

  async function handleExcluir(id: string) {
    setExcluindo(id)
    const res = await fetch(`/api/financeiro/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error ?? 'Erro ao excluir')
    } else {
      setDespesas(prev => prev.filter(d => d.id !== id))
    }
    setExcluindo(null)
  }

  async function marcarPago(d: Despesa) {
    const res = await fetch(`/api/financeiro/${d.id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...d, status: 'pago', pagamento_em: hoje }),
    })
    if (res.ok) {
      const updated = await res.json()
      setDespesas(prev => prev.map(x => x.id === d.id ? updated : x))
    }
  }

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight flex items-center gap-2">
            <TrendingDown size={20} className="text-[#1D5F60]" />
            Despesas
          </h1>
          <p className="text-[13px] text-[#7a8899] mt-0.5">Contas e despesas do escritório</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1D5F60] hover:bg-[#27777A] text-white text-[13px] font-semibold rounded-xl transition-colors shadow-sm"
        >
          <Plus size={15} /> Nova Despesa
        </button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-[#E2DDD8] p-4">
          <p className="text-[11px] text-[#9ca3af] mb-1">Total no período</p>
          <p className="text-[20px] font-bold text-[#0f1923]">{formatCurrency(metricas.total)}</p>
        </div>
        <div className="bg-[#e6f4ee] rounded-lg border border-[#b8dfc9] p-4">
          <p className="text-[11px] text-[#1a7a45]/70 mb-1">Pago</p>
          <p className="text-[20px] font-bold text-[#1a7a45]">{formatCurrency(metricas.pago)}</p>
        </div>
        <div className="bg-[#fef8ec] rounded-lg border border-[#f5e6b8] p-4">
          <p className="text-[11px] text-[#8a6000]/70 mb-1">Pendente</p>
          <p className="text-[20px] font-bold text-[#8a6000]">{formatCurrency(metricas.pendente)}</p>
        </div>
        <div className="bg-[#fde8e8] rounded-lg border border-[#f5c6c6] p-4">
          <p className="text-[11px] text-[#a93226]/70 mb-1">Vencido</p>
          <p className="text-[20px] font-bold text-[#a93226]">{formatCurrency(metricas.vencido)}</p>
        </div>
      </div>

      {/* Alerta: boletos não pagos */}
      {boletosNaoPagos.length > 0 && (
        <div className="bg-[#fde8e8] border border-[#f5c6c6] rounded-lg px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={15} className="text-[#a93226]" />
            <p className="text-[13px] font-semibold text-[#a93226]">
              {boletosNaoPagos.length} boleto(s) não pago(s) — vencido(s) ou vencendo em até 7 dias
            </p>
          </div>
          <div className="space-y-1.5">
            {boletosNaoPagos.slice(0, 8).map(d => (
              <div key={d.id} className="flex items-center justify-between text-[12px] bg-white/60 rounded-lg px-3 py-2">
                <span className="text-[#374151] truncate">{d.descricao}{d.cliente ? ` · ${d.cliente.nome}` : ''}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={cn('font-medium', d.vencimento < hoje ? 'text-[#a93226]' : 'text-[#8a6000]')}>
                    Vence {formatDate(d.vencimento)}
                  </span>
                  <span className="font-bold text-[#0f1923]">{formatCurrency(d.valor)}</span>
                  <button
                    onClick={() => marcarPago(d)}
                    className="flex items-center gap-1 text-[11px] font-medium text-[#1a7a45] hover:underline"
                  >
                    <CheckCircle2 size={12} /> Marcar pago
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-[#E2DDD8] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#f9fafb] flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c5cdd8]" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar descrição…"
              className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-white border border-[#e5e7eb] rounded-lg outline-none focus:border-[#1D5F60] text-[#374151] placeholder:text-[#c5cdd8]"
            />
          </div>
          <SelectFiltro value={periodo} onChange={setPeriodo} options={PERIODOS} />
          <SelectFiltro value={filtStatus} onChange={setFiltStatus} options={[
            { value: '', label: 'Todos os status' },
            { value: 'pendente',  label: 'Pendente'  },
            { value: 'pago',      label: 'Pago'      },
            { value: 'vencido',   label: 'Vencido'   },
            { value: 'cancelado', label: 'Cancelado' },
          ]} />
          <div className="min-w-[220px] max-w-sm flex-1">
            <SearchableCombobox
              value={filtCliente}
              onChange={value => setFiltCliente(value)}
              loadOptions={async (query) => fetchClienteOptions(query, 10)}
              placeholder="Todos os clientes"
              searchPlaceholder="Buscar cliente…"
              helperText="Digite ao menos 2 caracteres."
              emptyText="Digite para buscar clientes."
              noResultsText="Nenhum resultado encontrado."
              allowClear
            />
          </div>
          <span className="ml-auto text-[11px] text-[#9ca3af]">{filtrados.length} registros</span>
        </div>

        {/* Tabela */}
        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Wallet size={28} className="text-[#e5e7eb] mb-2" />
            <p className="text-[13px] text-[#9ca3af]">Nenhuma despesa encontrada</p>
          </div>
        ) : (
          <table className="w-full">
            <thead><tr className="bg-[#f9fafb] border-b border-[#f3f4f6]">
              <th className="text-left  text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Descrição</th>
              <th className="text-left  text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Cliente</th>
              <th className="text-left  text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Vencimento</th>
              <th className="text-left  text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Status</th>
              <th className="text-right text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Valor</th>
              <th className="text-right text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Ações</th>
            </tr></thead>
            <tbody>
              {filtrados.map(d => {
                const cfg = statusCfg[d.status] ?? statusCfg.pendente
                return (
                  <tr key={d.id} className="border-b border-[#f9fafb] last:border-0 hover:bg-[#fafbfb]">
                    <td className="px-4 py-3 text-[13px] text-[#374151]">
                      {d.descricao}
                      {d.categoria && <span className="block text-[11px] text-[#9ca3af]">{d.categoria}</span>}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#374151]">{d.cliente?.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-[13px] text-[#374151]">{formatDate(d.vencimento)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold', cfg.bg, cfg.text)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} /> {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] font-bold text-[#0f1923] tabular-nums">{formatCurrency(d.valor)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {d.status !== 'pago' && (
                          <button onClick={() => marcarPago(d)} title="Marcar como pago"
                            className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#1a7a45] hover:bg-[#e6f4ee] transition-colors">
                            <CheckCircle2 size={14} />
                          </button>
                        )}
                        <button onClick={() => abrirEdicao(d)} title="Editar"
                          className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors">
                          <Pencil size={14} />
                        </button>
                        {podeExcluir && (
                          <button
                            onClick={() => { if (confirm('Excluir esta despesa?')) handleExcluir(d.id) }}
                            disabled={excluindo === d.id}
                            title="Excluir"
                            className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#a93226] hover:bg-[#fde8e8] transition-colors disabled:opacity-40"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalAberto && (
        <LancamentoModal
          tipoFixo="despesa"
          lancamento={editando as any}
          onSalvar={handleSalvar}
          onFechar={fecharModal}
        />
      )}
    </div>
  )
}

function SelectFiltro({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="pl-3 pr-7 py-1.5 text-[12px] bg-white border border-[#e5e7eb] rounded-lg outline-none focus:border-[#1D5F60] text-[#374151] appearance-none">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  )
}
