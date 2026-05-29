'use client'

import { useState, useMemo } from 'react'
import {
  Plus, TrendingUp, TrendingDown, Clock, AlertCircle,
  Pencil, Trash2, CheckCircle2, ChevronDown, Search,
  Wallet, BarChart3, ListFilter,
} from 'lucide-react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { can } from '@/lib/permissions'
import type { UserRole } from '@/types'
import SearchableCombobox from '@/components/ui/SearchableCombobox'
import { fetchClienteOptions } from '@/lib/search/remote'
import LancamentoModal from './LancamentoModal'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface ClienteOpcao  { id: string; nome: string }
interface ProcessoOpcao { id: string; numero_processo: string | null; titulo: string }

interface Lancamento {
  id:           string
  tipo:         'receita' | 'despesa'
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
  lancamentos: Lancamento[]
  role:        UserRole
}

// ─── Config de status ────────────────────────────────────────────────────────

const statusCfg: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  pendente:  { bg: 'bg-[#fef8ec]', text: 'text-[#8a6000]', dot: 'bg-amber-400',  label: 'Pendente'  },
  pago:      { bg: 'bg-[#e6f4ee]', text: 'text-[#1a7a45]', dot: 'bg-[#2ecc71]',  label: 'Pago'      },
  vencido:   { bg: 'bg-[#fde8e8]', text: 'text-[#a93226]', dot: 'bg-[#e74c3c]',  label: 'Vencido'   },
  cancelado: { bg: 'bg-[#F3F1EE]', text: 'text-[#7a8899]', dot: 'bg-[#c5cdd8]',  label: 'Cancelado' },
}

type Aba = 'lancamentos' | 'receber' | 'pagar' | 'relatorios'

const ABAS: { id: Aba; label: string; icon: React.ElementType }[] = [
  { id: 'lancamentos', label: 'Lançamentos',  icon: ListFilter  },
  { id: 'receber',     label: 'A Receber',    icon: Clock       },
  { id: 'pagar',       label: 'A Pagar',      icon: TrendingDown },
  { id: 'relatorios',  label: 'Relatórios',   icon: BarChart3   },
]

const PERIODOS = [
  { value: 'todos',         label: 'Todo o período' },
  { value: 'este-mes',      label: 'Este mês'       },
  { value: 'mes-anterior',  label: 'Mês anterior'   },
  { value: 'trimestre',     label: 'Últimos 3 meses' },
  { value: 'ano',           label: 'Este ano'       },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

export default function FinanceiroPage({ lancamentos: inicial, role }: Props) {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>(inicial)
  const [aba,         setAba]         = useState<Aba>('lancamentos')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando,    setEditando]    = useState<Lancamento | null>(null)
  const [excluindo,   setExcluindo]   = useState<string | null>(null)

  // Filtros
  const [busca,      setBusca]      = useState('')
  const [periodo,    setPeriodo]    = useState('este-mes')
  const [filtStatus, setFiltStatus] = useState('')
  const [filtCliente,setFiltCliente]= useState('')

  const podeCriar  = can(role, 'financeiro', 'create')
  const podeEditar = can(role, 'financeiro', 'edit')
  const podeExcluir= can(role, 'financeiro', 'delete')

  // ── Dados filtrados ──────────────────────────────────────────────────────

  const filtrados = useMemo(() => {
    return lancamentos.filter(l => {
      // Filtro por aba
      if (aba === 'receber' && !(l.tipo === 'receita' && ['pendente', 'vencido'].includes(l.status))) return false
      if (aba === 'pagar'   && !(l.tipo === 'despesa' && ['pendente', 'vencido'].includes(l.status))) return false

      // Filtros extras
      if (filtStatus  && l.status !== filtStatus)              return false
      if (filtCliente && l.cliente_id !== filtCliente)         return false
      if (busca       && !l.descricao.toLowerCase().includes(busca.toLowerCase()) && !(l.categoria ?? '').toLowerCase().includes(busca.toLowerCase())) return false
      if (!filtrarPorPeriodo(l.vencimento, periodo))           return false

      return true
    })
  }, [lancamentos, aba, filtStatus, filtCliente, busca, periodo])

  // ── Métricas ────────────────────────────────────────────────────────────

  const metricas = useMemo(() => {
    const recebido  = lancamentos.filter(l => l.tipo === 'receita' && l.status === 'pago').reduce((s, l) => s + l.valor, 0)
    const despPago  = lancamentos.filter(l => l.tipo === 'despesa' && l.status === 'pago').reduce((s, l) => s + l.valor, 0)
    const aReceber  = lancamentos.filter(l => l.tipo === 'receita' && l.status === 'pendente').reduce((s, l) => s + l.valor, 0)
    const vencidos  = lancamentos.filter(l => l.status === 'vencido').reduce((s, l) => s + l.valor, 0)
    const saldo     = recebido - despPago

    // Este mês
    const hoje = new Date()
    const mesAtual = (l: Lancamento) =>
      new Date(l.vencimento + 'T12:00:00').getMonth() === hoje.getMonth() &&
      new Date(l.vencimento + 'T12:00:00').getFullYear() === hoje.getFullYear()

    const recMes   = lancamentos.filter(l => l.tipo === 'receita' && l.status === 'pago' && mesAtual(l)).reduce((s, l) => s + l.valor, 0)
    const despMes  = lancamentos.filter(l => l.tipo === 'despesa' && l.status === 'pago' && mesAtual(l)).reduce((s, l) => s + l.valor, 0)
    const inadimpl = lancamentos.filter(l => l.tipo === 'receita' && l.status === 'vencido').reduce((s, l) => s + l.valor, 0)
    const totalRec = lancamentos.filter(l => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0)
    const taxaInad = totalRec > 0 ? Math.round((inadimpl / totalRec) * 100) : 0

    return { recebido, despPago, aReceber, vencidos, saldo, recMes, despMes, inadimpl, taxaInad }
  }, [lancamentos])

  // ── Handlers CRUD ────────────────────────────────────────────────────────

  function abrirNovo() {
    setEditando(null)
    setModalAberto(true)
  }

  function abrirEdicao(l: Lancamento) {
    setEditando(l)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEditando(null)
  }

  async function handleSalvar(form: any): Promise<string | null> {
    const payload = {
      tipo:         form.tipo,
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
      setLancamentos(prev => prev.map(l => l.id === editando.id ? updated : l))
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
      setLancamentos(prev => [novo, ...prev])
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
      setLancamentos(prev => prev.filter(l => l.id !== id))
    }
    setExcluindo(null)
  }

  async function marcarPago(l: Lancamento) {
    const hoje = new Date().toISOString().slice(0, 10)
    const res = await fetch(`/api/financeiro/${l.id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...l, status: 'pago', pagamento_em: hoje, cliente_id: l.cliente_id, processo_id: l.processo_id }),
    })
    if (res.ok) {
      const updated = await res.json()
      setLancamentos(prev => prev.map(x => x.id === l.id ? updated : x))
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-6xl">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight flex items-center gap-2">
            <Wallet size={20} className="text-[#1D5F60]" />
            Financeiro
          </h1>
          <p className="text-[13px] text-[#7a8899] mt-0.5">Controle de receitas, despesas e relatórios</p>
        </div>
        {podeCriar && (
          <button
            onClick={abrirNovo}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1D5F60] hover:bg-[#27777A] text-white text-[13px] font-medium rounded-xl transition-colors shadow-sm"
          >
            <Plus size={15} />
            Novo Lançamento
          </button>
        )}
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Recebido',  value: metricas.recebido, icon: TrendingUp,   iconBg: 'bg-[#e6f4ee]', iconCl: 'text-[#2ecc71]', textCl: 'text-[#1a7a45]' },
          { label: 'Pago',      value: metricas.despPago, icon: TrendingDown,  iconBg: 'bg-[#fde8e8]', iconCl: 'text-[#e74c3c]', textCl: 'text-[#a93226]' },
          { label: 'A Receber', value: metricas.aReceber, icon: Clock,         iconBg: 'bg-[#e8f0fb]', iconCl: 'text-[#3498db]', textCl: 'text-[#1a4d9e]' },
          { label: 'Vencidos',  value: metricas.vencidos, icon: AlertCircle,   iconBg: 'bg-[#fde8e8]', iconCl: 'text-[#e74c3c]', textCl: 'text-[#a93226]' },
        ].map(m => {
          const Icon = m.icon
          return (
            <div key={m.label} className="bg-white rounded-lg border border-[#E2DDD8] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[12px] font-medium text-[#7a8899]">{m.label}</p>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${m.iconBg}`}>
                  <Icon size={15} className={m.iconCl} />
                </div>
              </div>
              <p className={`text-[20px] font-bold tracking-tight tabular-nums ${m.textCl}`}>
                {formatCurrency(m.value)}
              </p>
            </div>
          )
        })}
      </div>

      {/* Saldo */}
      <div className={cn(
        'rounded-lg border px-5 py-3.5 flex items-center justify-between',
        metricas.saldo >= 0 ? 'bg-[#e6f4ee] border-[#b8dfc9]' : 'bg-[#fde8e8] border-[#f5c6c6]',
      )}>
        <p className={`text-[13px] font-semibold ${metricas.saldo >= 0 ? 'text-[#1a7a45]' : 'text-[#a93226]'}`}>
          Saldo geral (recebido − despesas pagas)
        </p>
        <p className={`text-[18px] font-bold tabular-nums ${metricas.saldo >= 0 ? 'text-[#1a7a45]' : 'text-[#a93226]'}`}>
          {metricas.saldo >= 0 ? '+' : '−'} {formatCurrency(Math.abs(metricas.saldo))}
        </p>
      </div>

      {/* Abas */}
      <div className="bg-white rounded-lg border border-[#E2DDD8] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">

        <div className="flex border-b border-[#f3f4f6]">
          {ABAS.map(a => {
            const Icon = a.icon
            const ativo = aba === a.id
            return (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                className={cn(
                  'flex items-center gap-1.5 px-5 py-3.5 text-[13px] font-medium transition-all border-b-2 -mb-px',
                  ativo
                    ? 'border-[#145A5B] text-[#1D5F60] bg-[#f0f7f7]'
                    : 'border-transparent text-[#7a8899] hover:text-[#374151] hover:bg-[#f9fafb]',
                )}
              >
                <Icon size={14} />
                {a.label}
                {(a.id === 'receber' || a.id === 'pagar') && (() => {
                  const count = lancamentos.filter(l =>
                    a.id === 'receber'
                      ? l.tipo === 'receita' && ['pendente', 'vencido'].includes(l.status)
                      : l.tipo === 'despesa' && ['pendente', 'vencido'].includes(l.status),
                  ).length
                  return count > 0 ? (
                    <span className={cn(
                      'ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                      a.id === 'receber' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700',
                    )}>{count}</span>
                  ) : null
                })()}
              </button>
            )
          })}
        </div>

        {/* Conteúdo das abas */}
        {aba === 'relatorios' ? (
          <RelatoriosView metricas={metricas} />
        ) : (
          <>
            {/* Filtros */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-[#f9fafb] bg-[#fafbfb]">
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

              <SelectFiltro
                value={periodo}
                onChange={setPeriodo}
                options={PERIODOS}
              />

              {aba === 'lancamentos' && (
                <SelectFiltro
                  value={filtStatus}
                  onChange={setFiltStatus}
                  options={[
                    { value: '', label: 'Todos os status' },
                    { value: 'pendente',  label: 'Pendente'  },
                    { value: 'pago',      label: 'Pago'      },
                    { value: 'vencido',   label: 'Vencido'   },
                    { value: 'cancelado', label: 'Cancelado' },
                  ]}
                />
              )}

              <div className="min-w-[240px] max-w-sm flex-1">
                <SearchableCombobox
                  value={filtCliente}
                  onChange={(value) => setFiltCliente(value)}
                  loadOptions={async (query) => fetchClienteOptions(query, 10)}
                  placeholder="Todos os clientes"
                  searchPlaceholder="Buscar cliente…"
                  helperText="Digite ao menos 2 caracteres."
                  emptyText="Digite para buscar clientes."
                  noResultsText="Nenhum resultado encontrado."
                  allowClear
                  clearLabel="Todos os clientes"
                />
              </div>

              <span className="text-[11px] text-[#9ca3af] ml-auto shrink-0">
                {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Tabela */}
            {filtrados.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-[13px] text-[#9ca3af]">Nenhum lançamento encontrado</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f9fafb] border-b border-[#f3f4f6]">
                    <Th first>Descrição</Th>
                    <Th>Cliente / Processo</Th>
                    <Th>Vencimento</Th>
                    <Th>Tipo</Th>
                    <Th>Valor</Th>
                    <Th>Status</Th>
                    {(podeEditar || podeExcluir) && <Th last>Ações</Th>}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(l => {
                    const sc = statusCfg[l.status]
                    const venc = new Date(l.vencimento + 'T12:00:00')
                    const hoje = new Date()
                    const vencido = l.status !== 'pago' && l.status !== 'cancelado' && venc < hoje

                    return (
                      <tr key={l.id} className="border-b border-[#f5f7fa] last:border-0 hover:bg-[#fafbfb] transition-colors group">
                        <td className="px-5 py-3.5">
                          <p className="text-[13px] font-medium text-[#0f1923]">{l.descricao}</p>
                          {l.categoria && (
                            <p className="text-[11px] text-[#a8b3c4] mt-0.5">{l.categoria}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {l.cliente ? (
                            <p className="text-[12px] text-[#374151]">{l.cliente.nome}</p>
                          ) : null}
                          {l.processo ? (
                            <p className="text-[11px] text-[#9ca3af] mt-0.5 truncate max-w-[160px]">
                              {l.processo.numero_processo ?? l.processo.titulo}
                            </p>
                          ) : null}
                          {!l.cliente && !l.processo && <span className="text-[12px] text-[#c5cdd8]">—</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={cn('text-[12px]', vencido ? 'text-red-600 font-medium' : 'text-[#374151]')}>
                            {formatDate(l.vencimento)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={cn(
                            'text-[11px] font-semibold px-2.5 py-1 rounded-full',
                            l.tipo === 'receita' ? 'bg-[#e6f4ee] text-[#1a7a45]' : 'bg-[#fde8e8] text-[#a93226]',
                          )}>
                            {l.tipo === 'receita' ? 'Receita' : 'Despesa'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={cn(
                            'text-[13px] font-bold tabular-nums',
                            l.tipo === 'receita' ? 'text-[#1a7a45]' : 'text-[#a93226]',
                          )}>
                            {l.tipo === 'despesa' && '−'}{formatCurrency(l.valor)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {sc ? (
                            <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full', sc.bg, sc.text)}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                              {sc.label}
                            </span>
                          ) : (
                            <span className="text-[12px] text-[#7a8899]">{l.status}</span>
                          )}
                        </td>
                        {(podeEditar || podeExcluir) && (
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {podeEditar && l.status !== 'pago' && (
                                <button
                                  onClick={() => marcarPago(l)}
                                  title="Marcar como pago"
                                  className="p-1.5 rounded-lg text-[#c5cdd8] hover:text-[#1a7a45] hover:bg-[#e6f4ee] transition-colors"
                                >
                                  <CheckCircle2 size={14} />
                                </button>
                              )}
                              {podeEditar && (
                                <button
                                  onClick={() => abrirEdicao(l)}
                                  title="Editar"
                                  className="p-1.5 rounded-lg text-[#c5cdd8] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
                                >
                                  <Pencil size={14} />
                                </button>
                              )}
                              {podeExcluir && (
                                <button
                                  onClick={() => handleExcluir(l.id)}
                                  disabled={excluindo === l.id}
                                  title="Excluir"
                                  className="p-1.5 rounded-lg text-[#c5cdd8] hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {modalAberto && (
        <LancamentoModal
          lancamento={editando
            ? {
                id:           editando.id,
                tipo:         editando.tipo,
                descricao:    editando.descricao,
                categoria:    editando.categoria,
                valor:        editando.valor.toString(),
                vencimento:   editando.vencimento,
                pagamento_em: editando.pagamento_em ?? '',
                status:       editando.status,
                cliente_id:   editando.cliente_id ?? '',
                processo_id:  editando.processo_id ?? '',
                centro_custo: editando.centro_custo ?? '',
              }
            : null}
          onSalvar={handleSalvar}
          onFechar={fecharModal}
        />
      )}
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Th({ children, first, last }: { children?: React.ReactNode; first?: boolean; last?: boolean }) {
  return (
    <th className={`text-left text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-3 ${first ? 'px-5' : last ? 'px-4' : 'px-4'}`}>
      {children}
    </th>
  )
}

function SelectFiltro({ value, onChange, options }: {
  value:    string
  onChange: (v: string) => void
  options:  { value: string; label: string }[]
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pl-3 pr-7 py-1.5 text-[12px] bg-white border border-[#e5e7eb] rounded-lg outline-none focus:border-[#1D5F60] text-[#374151] appearance-none"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" />
    </div>
  )
}

function MetricaCard({ label, value, sub, cor }: { label: string; value: string; sub?: string; cor?: string }) {
  return (
    <div className="bg-[#f9fafb] rounded-xl p-4 border border-[#f3f4f6]">
      <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">{label}</p>
      <p className={cn('text-[22px] font-bold tabular-nums mt-1', cor ?? 'text-[#0f1923]')}>{value}</p>
      {sub && <p className="text-[11px] text-[#9ca3af] mt-0.5">{sub}</p>}
    </div>
  )
}

interface Metricas {
  recebido: number; despPago: number; aReceber: number; vencidos: number
  saldo: number; recMes: number; despMes: number; inadimpl: number; taxaInad: number
}

function RelatoriosView({ metricas }: { metricas: Metricas }) {
  const { recebido, despPago, aReceber, vencidos, saldo, recMes, despMes, inadimpl, taxaInad } = metricas

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">Este mês</p>
        <div className="grid grid-cols-3 gap-4">
          <MetricaCard label="Faturamento"    value={formatCurrency(recMes)}  cor="text-[#1a7a45]" />
          <MetricaCard label="Despesas"       value={formatCurrency(despMes)} cor="text-[#a93226]" />
          <MetricaCard label="Saldo do mês"   value={formatCurrency(recMes - despMes)} cor={(recMes - despMes) >= 0 ? 'text-[#1a7a45]' : 'text-[#a93226]'} />
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">Geral (todos os lançamentos)</p>
        <div className="grid grid-cols-4 gap-4">
          <MetricaCard label="Total recebido"   value={formatCurrency(recebido)}  cor="text-[#1a7a45]" />
          <MetricaCard label="Total pago"        value={formatCurrency(despPago)}  cor="text-[#a93226]" />
          <MetricaCard label="A receber"          value={formatCurrency(aReceber)}  cor="text-[#1a4d9e]" />
          <MetricaCard label="Saldo geral"        value={formatCurrency(saldo)}     cor={saldo >= 0 ? 'text-[#1a7a45]' : 'text-[#a93226]'} />
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">Inadimplência</p>
        <div className="grid grid-cols-2 gap-4">
          <MetricaCard label="Valor vencido"      value={formatCurrency(vencidos)} cor="text-[#a93226]" />
          <MetricaCard
            label="Taxa de inadimplência"
            value={`${taxaInad}%`}
            sub="sobre total de receitas lançadas"
            cor={taxaInad > 20 ? 'text-[#a93226]' : taxaInad > 10 ? 'text-[#8a6000]' : 'text-[#1a7a45]'}
          />
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-[#9ca3af] mb-1.5">
            <span>Inadimplência sobre receitas</span>
            <span className="font-semibold">{taxaInad}%</span>
          </div>
          <div className="h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', taxaInad > 20 ? 'bg-red-500' : taxaInad > 10 ? 'bg-amber-400' : 'bg-emerald-400')}
              style={{ width: `${Math.min(taxaInad, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Preparação futura: integração de pagamentos */}
      <div className="border border-dashed border-[#e5e7eb] rounded-xl p-4">
        <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1">Em breve</p>
        <p className="text-[12px] text-[#c5cdd8]">
          Geração de boletos e cobranças via PIX — estrutura de dados preparada para integração futura com gateways de pagamento.
        </p>
      </div>
    </div>
  )
}
