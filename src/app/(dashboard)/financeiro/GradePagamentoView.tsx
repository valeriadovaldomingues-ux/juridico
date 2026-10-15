'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Search, Trash2, Loader2 } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import SearchableCombobox from '@/components/ui/SearchableCombobox'
import { fetchClienteOptions } from '@/lib/search/remote'
import {
  anoMes, mesesDoAno, proximoStatus, resolverCelula, resumirCelulas, somarMesYM,
  type RegistroMes, type StatusMes,
} from '@/lib/financeiro/grade-mensal'

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

const STATUS_CFG: Record<StatusGrade | 'sem_registro', { label: string; bg: string; text: string; border: string }> = {
  pendente: { label: 'Pendente', bg: 'bg-[#fef8ec]', text: 'text-[#8a6000]', border: 'border-[#f5e6b8]' },
  pago:     { label: 'Pago',     bg: 'bg-[#e6f4ee]', text: 'text-[#1a7a45]', border: 'border-[#b8dfc9]' },
  vencido:  { label: 'Vencido',  bg: 'bg-[#fde8e8]', text: 'text-[#a93226]', border: 'border-[#f5c6c6]' },
  sem_registro: { label: 'Sem registro', bg: 'bg-[#f3f4f6]', text: 'text-[#9ca3af]', border: 'border-[#e5e7eb]' },
}

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const FORMA_LABEL: Record<FormaPagamento, string> = {
  pix: 'Pix', boleto: 'Boleto', deposito: 'Depósito', escritorio: 'Escritório', outro: 'Outro',
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function GradePagamentoView({ itens: inicial, podeExcluir }: Props) {
  const [itens, setItens] = useState<ItemGrade[]>(inicial)
  const [busca, setBusca] = useState('')
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [adicionando, setAdicionando] = useState(false)
  const [modoAdicao, setModoAdicao] = useState<'existente' | 'novo'>('existente')
  const [novoClienteId, setNovoClienteId] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [criando, setCriando] = useState(false)
  const [erroNovo, setErroNovo] = useState('')

  // ── Mês a mês ──
  const mesAtual = anoMes(new Date())
  const [modo, setModo] = useState<'mes' | 'ano'>('mes')
  const [mes, setMes] = useState(mesAtual)
  const ano = Number(mes.slice(0, 4))
  const [registros, setRegistros] = useState<Record<string, RegistroMes>>({})
  const [carregandoMeses, setCarregandoMeses] = useState(false)
  const [erroMeses, setErroMeses] = useState('')

  const carregarAno = useCallback(async (a: number) => {
    setCarregandoMeses(true)
    setErroMeses('')
    const res = await fetch(`/api/financeiro/grade-pagamento/meses?ano=${a}`)
    const json = await res.json().catch(() => ({}))
    setCarregandoMeses(false)
    if (!res.ok) { setErroMeses(json.error ?? 'Erro ao carregar os meses'); return }
    setRegistros(prev => {
      const novo: Record<string, RegistroMes> = {}
      for (const [k, v] of Object.entries(prev)) if (!k.includes(`|${a}-`)) novo[k] = v
      for (const r of json.registros as (RegistroMes & { mes: string })[]) novo[`${r.grade_id}|${r.mes.slice(0, 7)}`] = r
      return novo
    })
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarAno(ano)
  }, [ano, carregarAno])

  const celula = useCallback((item: ItemGrade, ym: string) =>
    resolverCelula(item.valor_mensal, registros[`${item.id}|${ym}`], ym, mesAtual), [registros, mesAtual])

  async function gravarMes(item: ItemGrade, ym: string, body: { valor?: number | null; status?: StatusMes }) {
    setSalvandoId(item.id)
    const res = await fetch('/api/financeiro/grade-pagamento/meses', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade_id: item.id, mes: ym, ...body }),
    })
    setSalvandoId(null)
    if (res.ok) {
      const r = (await res.json()) as RegistroMes
      setRegistros(prev => ({ ...prev, [`${item.id}|${ym}`]: r }))
    } else {
      setErroMeses((await res.json().catch(() => ({}))).error ?? 'Não consegui salvar')
    }
  }

  const filtrados = useMemo(() => {
    if (!busca) return itens
    const q = busca.toLowerCase()
    return itens.filter(i => (i.cliente?.nome ?? '').toLowerCase().includes(q))
  }, [itens, busca])

  const resumo = useMemo(() => {
    const meses = modo === 'mes' ? [mes] : mesesDoAno(ano)
    return resumirCelulas(itens.flatMap(i => meses.map(m => celula(i, m))))
  }, [itens, modo, mes, ano, celula])

  /** Valor mensal padrão da grade (vale para meses sem registro). */
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

  async function excluir(item: ItemGrade) {
    if (!confirm(`Remover ${item.cliente?.nome ?? 'este cliente'} da grade?`)) return
    const res = await fetch(`/api/financeiro/grade-pagamento/${item.id}`, { method: 'DELETE' })
    if (res.ok) setItens(prev => prev.filter(i => i.id !== item.id))
  }

  function fecharAdicao() {
    setAdicionando(false)
    setModoAdicao('existente')
    setNovoClienteId('')
    setNovoNome('')
    setErroNovo('')
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
      fecharAdicao()
    }
  }

  async function criarECliente() {
    const nome = novoNome.trim()
    if (!nome) return
    setCriando(true)
    setErroNovo('')

    const supabase = createClient()
    const { data: cliente, error } = await supabase
      .from('clientes')
      .insert({ nome, tipo_pessoa: 'juridica', ativo: true })
      .select('id, nome')
      .single()

    if (error || !cliente) {
      setErroNovo(error?.message ?? 'Erro ao criar cliente')
      setCriando(false)
      return
    }

    const res = await fetch('/api/financeiro/grade-pagamento', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ cliente_id: cliente.id }),
    })
    setCriando(false)
    if (res.ok) {
      const novo = await res.json()
      setItens(prev => [...prev, novo])
      fecharAdicao()
    } else {
      const body = await res.json().catch(() => ({}))
      setErroNovo(body.error ?? 'Cliente criado, mas houve erro ao adicionar na grade')
    }
  }

  const inputCls = 'px-2.5 py-1.5 text-[12px] bg-[#f9fafb] border border-[#e5e7eb] rounded-lg outline-none focus:bg-white focus:border-[#1D5F60] text-[#1a1d23]'

  return (
    <div className="p-6 space-y-5">
      {/* Período: mês a mês ou ano inteiro */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-white rounded-lg border border-[#e5e7eb] p-0.5">
          {(['mes', 'ano'] as const).map(m => (
            <button key={m} onClick={() => setModo(m)}
              className={cn('px-3 py-1 text-[12px] font-medium rounded-md transition-colors', modo === m ? 'bg-[#1D5F60] text-white' : 'text-[#6b7280] hover:text-[#374151]')}>
              {m === 'mes' ? 'Mês' : 'Ano inteiro'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMes(somarMesYM(mes, modo === 'ano' ? -12 : -1))} title="Anterior" className="p-1.5 rounded-lg border border-[#e5e7eb] bg-white hover:bg-[#f3f4f6]"><ChevronLeft size={14} /></button>
          <span className="px-2 text-[13px] font-semibold text-[#1D5F60] min-w-[150px] text-center capitalize">
            {modo === 'mes' ? `${MESES_LONGOS[Number(mes.slice(5)) - 1]} de ${ano}` : String(ano)}
          </span>
          <button onClick={() => setMes(somarMesYM(mes, modo === 'ano' ? 12 : 1))} title="Próximo" className="p-1.5 rounded-lg border border-[#e5e7eb] bg-white hover:bg-[#f3f4f6]"><ChevronRight size={14} /></button>
        </div>
        {(modo === 'ano' ? mes.slice(0, 4) !== mesAtual.slice(0, 4) : mes !== mesAtual) && (
          <button onClick={() => setMes(mesAtual)} className="text-[12px] text-[#1D5F60] hover:underline">Voltar para o mês atual</button>
        )}
        {carregandoMeses && <Loader2 size={14} className="animate-spin text-[#9ca3af]" />}
      </div>
      {erroMeses && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erroMeses}</p>}

      {/* Resumo */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#f9fafb] rounded-xl p-4 border border-[#f3f4f6] text-center">
          <p className="text-[11px] text-[#9ca3af] mb-1">{modo === 'mes' ? 'Total do mês' : 'Total do ano'}</p>
          <p className="text-[18px] font-bold text-[#0f1923]">{formatCurrency(resumo.total)}</p>
          {resumo.semRegistro > 0 && <p className="text-[10px] text-[#9ca3af] mt-0.5">{formatCurrency(resumo.semRegistro)} sem registro de pagamento</p>}
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
        Clique no status pra alternar: Pago → Vencido → Pendente. Meses passados sem registro aparecem em cinza até você marcar.
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
        {!adicionando && (
          <button
            onClick={() => setAdicionando(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#1D5F60] border border-[#145A5B]/30 rounded-lg hover:bg-[#E8F2F2] transition-colors"
          >
            <Plus size={13} /> Adicionar cliente
          </button>
        )}
      </div>

      {/* Painel de adição */}
      {adicionando && (
        <div className="bg-[#f9fafb] rounded-xl border border-[#f3f4f6] p-4 space-y-3">
          <div className="flex items-center gap-1 bg-white rounded-lg border border-[#e5e7eb] p-0.5 w-fit">
            <button
              onClick={() => setModoAdicao('existente')}
              className={cn('px-3 py-1 text-[12px] font-medium rounded-md transition-colors',
                modoAdicao === 'existente' ? 'bg-[#1D5F60] text-white' : 'text-[#6b7280] hover:text-[#374151]')}
            >
              Cliente existente
            </button>
            <button
              onClick={() => setModoAdicao('novo')}
              className={cn('px-3 py-1 text-[12px] font-medium rounded-md transition-colors',
                modoAdicao === 'novo' ? 'bg-[#1D5F60] text-white' : 'text-[#6b7280] hover:text-[#374151]')}
            >
              Criar novo cliente
            </button>
          </div>

          {modoAdicao === 'existente' ? (
            <div className="flex items-center gap-2">
              <div className="w-80">
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
              {novoClienteId && (
                <button onClick={adicionarCliente} className="px-3 py-1.5 text-[12px] font-semibold bg-[#1D5F60] hover:bg-[#27777A] text-white rounded-lg transition-colors shrink-0">
                  Adicionar
                </button>
              )}
              <button onClick={fecharAdicao} className="text-[12px] text-[#9ca3af] hover:text-[#374151]">Cancelar</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
                placeholder="Nome do cliente novo"
                className="w-80 px-3 py-1.5 text-[13px] bg-white border border-[#e5e7eb] rounded-lg outline-none focus:border-[#1D5F60] text-[#1a1d23] placeholder:text-[#c5cdd8]"
              />
              <button
                onClick={criarECliente}
                disabled={!novoNome.trim() || criando}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold bg-[#1D5F60] hover:bg-[#27777A] text-white rounded-lg transition-colors shrink-0 disabled:opacity-50"
              >
                {criando && <Loader2 size={12} className="animate-spin" />}
                Criar e adicionar
              </button>
              <button onClick={fecharAdicao} className="text-[12px] text-[#9ca3af] hover:text-[#374151]">Cancelar</button>
            </div>
          )}
          {erroNovo && <p className="text-[12px] text-red-600">{erroNovo}</p>}
          {modoAdicao === 'novo' && (
            <p className="text-[11px] text-[#9ca3af]">
              Cria um cadastro mínimo (só o nome) — complete os dados depois na tela de Clientes.
            </p>
          )}
        </div>
      )}

      {/* Grade */}
      {modo === 'mes' ? (
      <div className="rounded-xl border border-[#f3f4f6] overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-[#f9fafb] border-b border-[#f3f4f6]">
            <th className="text-left  text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Cliente</th>
            <th className="text-right text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4 w-36">Valor padrão</th>
            <th className="text-right text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4 w-36">Valor do mês</th>
            <th className="text-left  text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4 w-40">Forma de pagamento</th>
            <th className="text-left  text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4 w-32">Status</th>
            <th className="w-10"></th>
          </tr></thead>
          <tbody>
            {filtrados.map(item => {
              const c = celula(item, mes)
              const cfg = STATUS_CFG[c.status]
              return (
                <tr key={item.id} className="border-b border-[#f9fafb] last:border-0 hover:bg-[#fafbfb]">
                  <td className="px-4 py-2.5 text-[13px] text-[#374151]">{item.cliente?.nome ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number" step="0.01" min="0"
                      defaultValue={item.valor_mensal ?? ''}
                      title="Vale para os meses que ainda não têm valor próprio"
                      onBlur={e => {
                        const v = e.target.value === '' ? null : Number(e.target.value)
                        if (v !== item.valor_mensal) patch(item, { valor_mensal: v })
                      }}
                      className={cn(inputCls, 'w-full text-right')}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      key={`${item.id}-${mes}-${c.valor ?? ''}`}
                      type="number" step="0.01" min="0"
                      defaultValue={c.valor ?? ''}
                      onBlur={e => {
                        const v = e.target.value === '' ? null : Number(e.target.value)
                        if (v !== c.valor) gravarMes(item, mes, { valor: v })
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
                      onClick={() => gravarMes(item, mes, { status: proximoStatus(c.status) })}
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
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[12px] text-[#9ca3af]">Nenhum cliente encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
      ) : (
      <div className="rounded-xl border border-[#f3f4f6] overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead><tr className="bg-[#f9fafb] border-b border-[#f3f4f6]">
            <th className="text-left text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-3 sticky left-0 bg-[#f9fafb] min-w-[200px]">Cliente</th>
            {MESES_CURTOS.map(m => <th key={m} className="text-center text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-1">{m}</th>)}
            <th className="text-right text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-3">Ano</th>
          </tr></thead>
          <tbody>
            {filtrados.map(item => {
              const cels = mesesDoAno(ano).map(m => ({ m, c: celula(item, m) }))
              return (
                <tr key={item.id} className="border-b border-[#f9fafb] last:border-0">
                  <td className="px-3 py-1.5 text-[12px] text-[#374151] sticky left-0 bg-white">{item.cliente?.nome ?? '—'}</td>
                  {cels.map(({ m, c }) => {
                    const cfg = STATUS_CFG[c.status]
                    return (
                      <td key={m} className="px-0.5 py-1">
                        <button
                          onClick={() => gravarMes(item, m, { status: proximoStatus(c.status) })}
                          disabled={salvandoId === item.id}
                          title={`${cfg.label} — clique para alternar`}
                          className={cn('w-full px-1 py-1 rounded border text-[11px] tabular-nums font-medium disabled:opacity-50', cfg.bg, cfg.text, cfg.border)}
                        >
                          {c.valor ? Math.round(c.valor).toLocaleString('pt-BR') : '—'}
                        </button>
                      </td>
                    )
                  })}
                  <td className="px-3 py-1.5 text-right text-[12px] font-semibold tabular-nums text-[#374151]">
                    {formatCurrency(cels.reduce((a, { c }) => a + (c.valor ?? 0), 0))}
                  </td>
                </tr>
              )
            })}
            <tr className="bg-[#f9fafb] font-semibold border-t border-[#e5e7eb]">
              <td className="px-3 py-2 text-[12px] text-[#0f1923] sticky left-0 bg-[#f9fafb]">Total do mês</td>
              {mesesDoAno(ano).map(m => (
                <td key={m} className="px-0.5 py-2 text-center text-[11px] tabular-nums text-[#0f1923]">
                  {Math.round(filtrados.reduce((a, i) => a + (celula(i, m).valor ?? 0), 0)).toLocaleString('pt-BR')}
                </td>
              ))}
              <td className="px-3 py-2 text-right text-[12px] tabular-nums text-[#0f1923]">{formatCurrency(resumo.total)}</td>
            </tr>
            <tr className="bg-[#e6f4ee]/50 font-semibold">
              <td className="px-3 py-2 text-[12px] text-[#1a7a45] sticky left-0 bg-[#f3faf6]">Recebido</td>
              {mesesDoAno(ano).map(m => (
                <td key={m} className="px-0.5 py-2 text-center text-[11px] tabular-nums text-[#1a7a45]">
                  {Math.round(filtrados.reduce((a, i) => { const c = celula(i, m); return a + (c.status === 'pago' ? (c.valor ?? 0) : 0) }, 0)).toLocaleString('pt-BR')}
                </td>
              ))}
              <td className="px-3 py-2 text-right text-[12px] tabular-nums text-[#1a7a45]">{formatCurrency(resumo.pago)}</td>
            </tr>
            {filtrados.length === 0 && (
              <tr><td colSpan={14} className="px-4 py-8 text-center text-[12px] text-[#9ca3af]">Nenhum cliente encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}
