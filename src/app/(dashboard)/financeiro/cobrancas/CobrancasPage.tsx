'use client'

import { useMemo, useState } from 'react'
import {
  AlertCircle,
  Banknote,
  Clipboard,
  Copy,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  ExternalLink,
  Trash2,
  X,
} from 'lucide-react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { can } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types'
import type { Cobranca, CobrancaStatus } from '@/types/cobrancas'
import PagadorInterModal from './PagadorInterModal'

interface ClienteOpcao {
  id: string
  nome: string
  cpf_cnpj: string | null
  email: string | null
  tipo_pessoa: string | null
  cep: string | null
  endereco: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
}

interface ProcessoOpcao {
  id: string
  numero_processo: string | null
  titulo: string | null
  cliente_id: string | null
}

interface Props {
  initialCobrancas: Cobranca[]
  clientes: ClienteOpcao[]
  processos: ProcessoOpcao[]
  role: UserRole
}

type TipoCaso = '' | 'isolado' | 'partido'

type ChargeFormValues = {
  cliente_id: string
  processo_id: string
  valor: string
  descricao: string
  data_vencimento?: string
  data_vencimento_inicial?: string
  quantidade_parcelas?: string
  dia_vencimento?: string
  // Só usados no modo "recorrente" (Gerar contrato):
  tipo_caso?: TipoCaso
  percentual_exito?: string
  parcela_extra_dezembro?: boolean
  valor_variavel?: boolean
  valores_mensais?: string[]
}

type PagadorFormValues = {
  cpf_cnpj:    string
  tipo_pessoa: string
  cep:         string
  endereco:    string
  numero:      string
  complemento: string
  bairro:      string
  cidade:      string
  uf:          string
}

const emptyPagador: PagadorFormValues = {
  cpf_cnpj: '', tipo_pessoa: '', cep: '', endereco: '',
  numero: '', complemento: '', bairro: '', cidade: '', uf: '',
}

function pagadorFromCliente(cliente: ClienteOpcao | undefined): PagadorFormValues {
  return {
    cpf_cnpj:    cliente?.cpf_cnpj    ?? '',
    tipo_pessoa: cliente?.tipo_pessoa ?? '',
    cep:         cliente?.cep         ?? '',
    endereco:    cliente?.endereco    ?? '',
    numero:      cliente?.numero      ?? '',
    complemento: cliente?.complemento ?? '',
    bairro:      cliente?.bairro      ?? '',
    cidade:      cliente?.cidade      ?? '',
    uf:          cliente?.uf          ?? '',
  }
}

const statusCfg: Record<CobrancaStatus, { label: string; chip: string; dot: string }> = {
  rascunho: { label: 'Rascunho', chip: 'bg-zinc-100 text-zinc-700', dot: 'bg-zinc-400' },
  pendente: { label: 'Em aberto', chip: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400' },
  processando: { label: 'Processando', chip: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  emitida: { label: 'Emitida', chip: 'bg-sky-50 text-sky-700', dot: 'bg-sky-400' },
  erro_emissao: { label: 'Erro emissao', chip: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  vencida: { label: 'Vencida', chip: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
  paga: { label: 'Paga', chip: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  cancelada: { label: 'Cancelada', chip: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
}

const emptyForm = {
  cliente_id: '',
  processo_id: '',
  valor: '',
  data_vencimento: new Date().toISOString().slice(0, 10),
  descricao: '',
}

const emptyRecorrente: ChargeFormValues = {
  cliente_id: '',
  processo_id: '',
  valor: '',
  data_vencimento_inicial: new Date().toISOString().slice(0, 10),
  quantidade_parcelas: '12',
  dia_vencimento: String(new Date().getDate()),
  descricao: '',
  tipo_caso: '',
  percentual_exito: '',
  parcela_extra_dezembro: false,
  valor_variavel: false,
  valores_mensais: [],
}

export default function CobrancasPage({ initialCobrancas, clientes, processos, role }: Props) {
  const [cobrancas, setCobrancas] = useState(initialCobrancas)
  const [selectedId, setSelectedId] = useState(initialCobrancas[0]?.id ?? '')
  const [modal, setModal] = useState<'unica' | 'recorrente' | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [recorrente, setRecorrente] = useState(emptyRecorrente)
  const [pagadorForm, setPagadorForm] = useState<PagadorFormValues>(emptyPagador)
  const [status, setStatus] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [mes, setMes] = useState('')
  const [busca, setBusca] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pagadorModalCobranca, setPagadorModalCobranca] = useState<Cobranca | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Cobranca | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteReason, setDeleteReason] = useState('')
  const [deleting, setDeleting] = useState(false)

  const podeCriar = can(role, 'financeiro', 'create') || ['administrativo', 'gerente', 'socio'].includes(role)
  const podeExcluir = role === 'socio'
  const selected = cobrancas.find(c => c.id === selectedId) ?? cobrancas[0] ?? null

  const filtradas = useMemo(() => {
    return cobrancas.filter(c => {
      if (status && c.status !== status) return false
      if (clienteId && c.cliente_id !== clienteId) return false
      if (mes && !c.data_vencimento.startsWith(mes)) return false
      const haystack = `${c.descricao} ${c.cliente?.nome ?? ''} ${c.processo?.titulo ?? ''}`.toLowerCase()
      if (busca && !haystack.includes(busca.toLowerCase())) return false
      return true
    })
  }, [cobrancas, status, clienteId, mes, busca])

  const metricas = useMemo(() => {
    const aberto = cobrancas.filter(c => ['pendente', 'processando', 'emitida', 'vencida', 'erro_emissao'].includes(c.status)).reduce((s, c) => s + Number(c.valor), 0)
    const pago = cobrancas.filter(c => c.status === 'paga').reduce((s, c) => s + Number(c.valor_pago ?? c.valor), 0)
    const vencidas = cobrancas.filter(c => c.status === 'vencida').length
    return { aberto, pago, vencidas, total: cobrancas.length }
  }, [cobrancas])

  const processosDoCliente = processos.filter(p => {
    const cid = modal === 'recorrente' ? recorrente.cliente_id : form.cliente_id
    return !cid || p.cliente_id === cid
  })

  /** Salva os dados do pagador (CPF/CNPJ, endereço...) direto no cadastro
   *  do cliente, se algo foi preenchido na tela de nova cobrança. Não
   *  bloqueia a criação da cobrança se falhar — a tela de emissão
   *  (PagadorInterModal) continua como conferência final antes do Inter. */
  async function salvarDadosPagador(clienteId: string) {
    if (!clienteId) return
    const preenchido = Object.values(pagadorForm).some(v => v.trim())
    if (!preenchido) return
    const supabase = createClient()
    await supabase.from('clientes').update({
      cpf_cnpj:    pagadorForm.cpf_cnpj.trim()    || null,
      tipo_pessoa: pagadorForm.tipo_pessoa         || null,
      cep:         pagadorForm.cep.trim()         || null,
      endereco:    pagadorForm.endereco.trim()    || null,
      numero:      pagadorForm.numero.trim()      || null,
      complemento: pagadorForm.complemento.trim() || null,
      bairro:      pagadorForm.bairro.trim()      || null,
      cidade:      pagadorForm.cidade.trim()      || null,
      uf:          pagadorForm.uf.trim().toUpperCase() || null,
    }).eq('id', clienteId)
  }

  async function createSingle() {
    setSaving(true)
    setError(null)
    await salvarDadosPagador(form.cliente_id)
    const payload = {
      ...form,
      valor: Number(form.valor.replace(',', '.')),
      processo_id: form.processo_id || null,
    }
    const res = await fetch('/api/financeiro/cobrancas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(data.error ?? 'Erro ao criar cobranca.')
      return
    }
    setCobrancas(prev => [data, ...prev])
    setSelectedId(data.id)
    setForm(emptyForm)
    setPagadorForm(emptyPagador)
    setModal(null)
  }

  async function createRecurring() {
    setSaving(true)
    setError(null)
    await salvarDadosPagador(recorrente.cliente_id)
    const quantidade = Number(recorrente.quantidade_parcelas)
    const valorVariavel = recorrente.tipo_caso === 'partido' && !!recorrente.valor_variavel
    const payload = {
      ...recorrente,
      valor: Number(recorrente.valor.replace(',', '.')),
      quantidade_parcelas: quantidade,
      dia_vencimento: Number(recorrente.dia_vencimento),
      processo_id: recorrente.processo_id || null,
      tipo_caso: recorrente.tipo_caso || undefined,
      percentual_exito: recorrente.tipo_caso === 'isolado' ? (recorrente.percentual_exito || undefined) : undefined,
      parcela_extra_dezembro: recorrente.tipo_caso === 'partido' && !valorVariavel ? !!recorrente.parcela_extra_dezembro : undefined,
      valores_mensais: valorVariavel
        ? Array.from({ length: quantidade }, (_, i) => Number((recorrente.valores_mensais?.[i] ?? '0').replace(',', '.')))
        : undefined,
      valor_variavel: undefined,
    }
    const res = await fetch('/api/financeiro/cobrancas/gerar-recorrentes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(data.error ?? 'Erro ao gerar recorrencia.')
      return
    }
    setCobrancas(prev => [...data, ...prev])
    setSelectedId(data[0]?.id ?? selectedId)
    setRecorrente(emptyRecorrente)
    setPagadorForm(emptyPagador)
    setModal(null)
  }

  async function sincronizar(cobranca: Cobranca) {
    setBusyId(cobranca.id)
    setError(null)
    const res = await fetch(`/api/financeiro/cobrancas/${cobranca.id}/sincronizar`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setBusyId(null)
    if (!res.ok) {
      setError(data.error ?? 'Erro ao sincronizar no Inter.')
      return
    }
    setCobrancas(prev => prev.map(c => c.id === data.id ? data : c))
  }

  function mensagemCliente(c: Cobranca) {
    const nome = c.cliente?.nome ?? 'cliente'
    return `Ola, ${nome}. Segue cobranca referente aos honorarios advocaticios do PEDV Advocacia, com vencimento em ${formatDate(c.data_vencimento)}, no valor de ${formatCurrency(Number(c.valor))}. Voce pode pagar por boleto ou Pix pelo QR Code/linha abaixo.\n\nLinha digitavel: ${c.linha_digitavel ?? 'a emitir'}\nPix copia e cola: ${c.pix_copia_cola ?? 'a emitir'}`
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text)
  }

  function openDeleteModal(cobranca: Cobranca) {
    setDeleteTarget(cobranca)
    setDeleteConfirm('')
    setDeleteReason('')
    setError(null)
  }

  function closeDeleteModal() {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteConfirm('')
    setDeleteReason('')
  }

  async function excluirCobranca() {
    if (!deleteTarget || deleteConfirm !== 'EXCLUIR') return
    setDeleting(true)
    setError(null)
    const res = await fetch(`/api/financeiro/cobrancas/${deleteTarget.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo: deleteReason.trim() || null }),
    })
    const data = await res.json().catch(() => ({}))
    setDeleting(false)

    if (!res.ok) {
      setError(data.error ?? 'Nao foi possivel excluir a cobranca.')
      return
    }

    const nextCobrancas = cobrancas.filter(c => c.id !== deleteTarget.id)
    setCobrancas(nextCobrancas)
    setSelectedId(current => current === deleteTarget.id ? nextCobrancas[0]?.id ?? '' : current)
    closeDeleteModal()
  }

  const deleteBlockReason = selected ? getDeleteBlockReason(selected) : null

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight flex items-center gap-2">
            <Banknote size={21} className="text-[#145A5B]" />
            Cobrancas
          </h1>
          <p className="text-[13px] text-[#7a8899] mt-0.5">Contas a receber com estrutura para boleto Pix do Banco Inter.</p>
        </div>
        {podeCriar && (
          <div className="flex items-center gap-2">
            <button onClick={() => setModal('recorrente')} className="inline-flex items-center gap-2 px-3 py-2 border border-[#d8dee8] text-[#34495e] text-[13px] font-medium rounded-lg hover:bg-[#F7F9F9]">
              <Clipboard size={15} />
              Gerar contrato
            </button>
            <button onClick={() => setModal('unica')} className="inline-flex items-center gap-2 px-3 py-2 bg-[#0F3D3E] hover:bg-[#145A5B] text-white text-[13px] font-medium rounded-lg">
              <Plus size={15} />
              Nova cobranca
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
          <AlertCircle size={16} className="mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Metric label="Em aberto" value={formatCurrency(metricas.aberto)} />
        <Metric label="Recebido" value={formatCurrency(metricas.pago)} />
        <Metric label="Vencidas" value={String(metricas.vencidas)} />
        <Metric label="Total" value={String(metricas.total)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e8edf2] bg-white p-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por cliente, processo ou descricao" className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] outline-none focus:ring-2 focus:ring-[#0F3D3E]/15" />
            </div>
            <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] bg-white">
              <option value="">Todos status</option>
              {Object.entries(statusCfg).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
            </select>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)} className="px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] bg-white max-w-[220px]">
              <option value="">Todos clientes</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px]" />
          </div>

          <div className="overflow-hidden rounded-lg border border-[#e8edf2] bg-white">
            <table className="w-full text-left">
              <thead className="bg-[#F7F9F9] text-[11px] uppercase tracking-wide text-[#7a8899]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Vencimento</th>
                  <th className="px-4 py-3 font-semibold">Parcela</th>
                  <th className="px-4 py-3 font-semibold">Valor</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2f5]">
                {filtradas.map(c => (
                  <tr key={c.id} onClick={() => setSelectedId(c.id)} className={cn('cursor-pointer hover:bg-[#F7F9F9]', selected?.id === c.id && 'bg-[#eef7f7]')}>
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-medium text-[#0f1923]">{c.cliente?.nome ?? 'Cliente'}</p>
                      <p className="text-[12px] text-[#7a8899] truncate max-w-[300px]">{c.descricao}</p>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#34495e]">{formatDate(c.data_vencimento)}</td>
                    <td className="px-4 py-3 text-[13px] text-[#34495e]">{c.parcela_numero}/{c.parcela_total}</td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-[#0f1923]">{formatCurrency(Number(c.valor))}</td>
                    <td className="px-4 py-3"><StatusChip status={c.status} /></td>
                  </tr>
                ))}
                {filtradas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-[13px] text-[#7a8899]">Nenhuma cobranca encontrada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-lg border border-[#e8edf2] bg-white p-4 space-y-4">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] text-[#7a8899]">Detalhes da cobranca</p>
                  <h2 className="text-[16px] font-semibold text-[#0f1923] mt-0.5">{selected.cliente?.nome ?? 'Cliente'}</h2>
                </div>
                <StatusChip status={selected.status} />
              </div>

              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <Info label="Valor" value={formatCurrency(Number(selected.valor))} />
                <Info label="Vencimento" value={formatDate(selected.data_vencimento)} />
                <Info label="Parcela" value={`${selected.parcela_numero}/${selected.parcela_total}`} />
                <Info label="Inter" value={selected.inter_status ?? 'Nao emitida'} />
                <Info label="Solicitacao" value={selected.inter_cobranca_id ?? 'Nao informada'} />
                <Info label="Pago em" value={selected.data_pagamento ? formatDate(selected.data_pagamento) : 'Nao informado'} />
                <Info label="Valor pago" value={selected.valor_pago != null ? formatCurrency(Number(selected.valor_pago)) : 'Nao informado'} />
              </div>

              <div>
                <p className="text-[12px] font-medium text-[#7a8899] mb-1">Descricao</p>
                <p className="text-[13px] text-[#34495e]">{selected.descricao}</p>
              </div>

              <CopyBox label="Linha digitavel" value={selected.linha_digitavel} onCopy={copy} />
              <CopyBox label="Pix copia e cola" value={selected.pix_copia_cola} onCopy={copy} />

              {selected.inter_cobranca_id && (
                <a
                  href={`/api/financeiro/cobrancas/${selected.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#d8dee8] text-[#34495e] text-[13px] font-medium hover:bg-[#F7F9F9]"
                >
                  <ExternalLink size={15} />
                  Abrir PDF do boleto
                </a>
              )}

              {selected.erro_emissao && (
                <div className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2 text-[12px] text-rose-700">
                  {selected.erro_emissao}
                </div>
              )}

              {selected.status === 'processando' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                  A cobranca foi enviada ao Inter e ainda esta em processamento. Use Atualizar status no Inter para consultar novamente.
                </div>
              )}

              <div className="grid grid-cols-1 gap-2">
                <button onClick={() => setPagadorModalCobranca(selected)} disabled={busyId === selected.id || selected.status === 'paga'} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#0F3D3E] text-white text-[13px] font-medium disabled:opacity-60">
                  {busyId === selected.id ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                  Gerar boleto/Pix no Inter
                </button>
                <button onClick={() => sincronizar(selected)} disabled={busyId === selected.id || !selected.inter_cobranca_id} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#d8dee8] text-[#34495e] text-[13px] font-medium disabled:opacity-60">
                  <RefreshCw size={15} />
                  Atualizar status no Inter
                </button>
                <button onClick={() => copy(mensagemCliente(selected))} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#d8dee8] text-[#34495e] text-[13px] font-medium">
                  <Send size={15} />
                  Copiar mensagem WhatsApp
                </button>
                {podeExcluir && (
                  <div className="pt-2 border-t border-[#eef2f5]">
                    <button
                      onClick={() => openDeleteModal(selected)}
                      disabled={Boolean(deleteBlockReason) || busyId === selected.id}
                      className="inline-flex w-full items-center justify-center gap-2 px-3 py-2 rounded-lg border border-rose-200 text-rose-700 text-[13px] font-medium hover:bg-rose-50 disabled:opacity-60 disabled:hover:bg-white"
                    >
                      <Trash2 size={15} />
                      Excluir cobrança
                    </button>
                    {deleteBlockReason && (
                      <p className="mt-2 text-[12px] text-[#7a8899]">{deleteBlockReason}</p>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-[13px] text-[#7a8899]">Selecione uma cobranca.</div>
          )}
        </aside>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl border border-[#e8edf2]">
            <div className="px-5 py-4 border-b border-[#eef2f5] flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-[#0f1923]">{modal === 'unica' ? 'Nova cobranca' : 'Gerar cobrancas do contrato'}</h2>
              <button onClick={() => setModal(null)}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <ChargeForm
                form={modal === 'unica' ? form : recorrente}
                setForm={
                  modal === 'unica'
                    ? setForm as React.Dispatch<React.SetStateAction<ChargeFormValues>>
                    : setRecorrente as React.Dispatch<React.SetStateAction<ChargeFormValues>>
                }
                clientes={clientes}
                processos={processosDoCliente}
                recorrente={modal === 'recorrente'}
                pagadorForm={pagadorForm}
                setPagadorForm={setPagadorForm}
              />
              <div className="rounded-lg bg-[#F7F9F9] border border-[#e8edf2] p-3 text-[12px] text-[#5b6776]">
                Revise cliente, valor, vencimento e descricao antes de salvar. Nesta versao, a emissao no Inter e a confirmacao de boleto/Pix acontecem de forma ativa apos a criacao.
              </div>
            </div>
            <div className="px-5 py-4 border-t border-[#eef2f5] flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px]">Cancelar</button>
              <button onClick={modal === 'unica' ? createSingle : createRecurring} disabled={saving} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0F3D3E] text-white text-[13px] font-medium disabled:opacity-60">
                {saving && <Loader2 size={15} className="animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {pagadorModalCobranca && (
        <PagadorInterModal
          cobranca={pagadorModalCobranca}
          onClose={() => setPagadorModalCobranca(null)}
          onEmitted={(updated) => setCobrancas(prev => prev.map(c => c.id === updated.id ? updated : c))}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl border border-[#e8edf2]">
            <div className="px-5 py-4 border-b border-[#eef2f5] flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-[#0f1923]">Excluir cobrança</h2>
              <button onClick={closeDeleteModal} disabled={deleting}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
                Esta ação não poderá ser desfeita. A cobrança será removida fisicamente após o registro do log de auditoria.
              </div>
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <Info label="Cliente" value={deleteTarget.cliente?.nome ?? 'Cliente'} />
                <Info label="Valor" value={formatCurrency(Number(deleteTarget.valor))} />
                <Info label="Vencimento" value={formatDate(deleteTarget.data_vencimento)} />
                <Info label="Status" value={statusCfg[deleteTarget.status]?.label ?? deleteTarget.status} />
              </div>
              <div>
                <p className="text-[12px] font-medium text-[#7a8899] mb-1">Descrição</p>
                <p className="text-[13px] text-[#34495e]">{deleteTarget.descricao}</p>
              </div>
              <label className="block space-y-1">
                <span className="text-[12px] font-medium text-[#34495e]">Motivo da exclusão (opcional)</span>
                <textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] resize-none" />
              </label>
              <label className="block space-y-1">
                <span className="text-[12px] font-medium text-[#34495e]">Digite EXCLUIR para confirmar</span>
                <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px]" />
              </label>
            </div>
            <div className="px-5 py-4 border-t border-[#eef2f5] flex justify-end gap-2">
              <button onClick={closeDeleteModal} disabled={deleting} className="px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px]">Cancelar</button>
              <button onClick={excluirCobranca} disabled={deleting || deleteConfirm !== 'EXCLUIR'} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-700 text-white text-[13px] font-medium disabled:opacity-60">
                {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Excluir cobrança
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getDeleteBlockReason(cobranca: Cobranca) {
  if (!['rascunho', 'pendente', 'erro_emissao'].includes(cobranca.status)) {
    return 'Esta cobrança não pode ser excluída neste status.'
  }
  if (
    cobranca.inter_cobranca_id ||
    cobranca.nosso_numero ||
    cobranca.linha_digitavel ||
    cobranca.codigo_barras ||
    cobranca.pix_qrcode ||
    cobranca.pix_copia_cola ||
    cobranca.boleto_pdf_url ||
    cobranca.inter_status ||
    cobranca.payload_criacao ||
    cobranca.payload_ultimo_status
  ) {
    return 'Esta cobrança possui indícios de emissão no Banco Inter. Cancele a cobrança em vez de excluir.'
  }
  return null
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e8edf2] bg-white p-4">
      <p className="text-[12px] text-[#7a8899]">{label}</p>
      <p className="text-[20px] font-semibold text-[#0f1923] mt-1">{value}</p>
    </div>
  )
}

function StatusChip({ status }: { status: CobrancaStatus }) {
  const cfg = statusCfg[status] ?? statusCfg.pendente
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium', cfg.chip)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#F7F9F9] px-3 py-2">
      <p className="text-[11px] text-[#7a8899]">{label}</p>
      <p className="text-[13px] font-medium text-[#0f1923] truncate">{value}</p>
    </div>
  )
}

function CopyBox({ label, value, onCopy }: { label: string; value: string | null; onCopy: (text: string) => void }) {
  return (
    <div>
      <p className="text-[12px] font-medium text-[#7a8899] mb-1">{label}</p>
      <div className="flex items-center gap-2 rounded-lg border border-[#e8edf2] bg-[#F7F9F9] px-3 py-2">
        <p className="flex-1 min-w-0 truncate text-[12px] text-[#34495e]">{value ?? 'Nao disponivel'}</p>
        <button disabled={!value} onClick={() => value && onCopy(value)} className="p-1.5 rounded-md hover:bg-white disabled:opacity-40" title="Copiar">
          <Copy size={14} />
        </button>
      </div>
    </div>
  )
}

function ChargeForm({
  form,
  setForm,
  clientes,
  processos,
  recorrente,
  pagadorForm,
  setPagadorForm,
}: {
  form: ChargeFormValues
  setForm: React.Dispatch<React.SetStateAction<ChargeFormValues>>
  clientes: ClienteOpcao[]
  processos: ProcessoOpcao[]
  recorrente: boolean
  pagadorForm: PagadorFormValues
  setPagadorForm: React.Dispatch<React.SetStateAction<PagadorFormValues>>
}) {
  const set = (key: keyof ChargeFormValues, value: string) => setForm(prev => ({ ...prev, [key]: value }))
  const setPagador = (key: keyof PagadorFormValues, value: string) => setPagadorForm(prev => ({ ...prev, [key]: value }))

  function selecionarCliente(id: string) {
    set('cliente_id', id)
    setPagadorForm(pagadorFromCliente(clientes.find(c => c.id === id)))
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <label className="space-y-1 md:col-span-2">
        <span className="text-[12px] font-medium text-[#34495e]">Cliente</span>
        <select value={form.cliente_id} onChange={e => selecionarCliente(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] bg-white">
          <option value="">Selecione</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </label>

      {form.cliente_id && (
        <div className="md:col-span-2 rounded-lg border border-[#e8edf2] bg-[#F7F9F9] p-3 space-y-3">
          <p className="text-[12px] font-semibold text-[#34495e]">
            Dados do pagador <span className="font-normal text-[#7a8899]">— necessários pra emitir boleto/Pix no Inter; confira ou complete</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="block text-[11px] font-medium text-[#7a8899] mb-1">CPF/CNPJ</span>
              <input value={pagadorForm.cpf_cnpj} onChange={e => setPagador('cpf_cnpj', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] bg-white" />
            </div>
            <div>
              <span className="block text-[11px] font-medium text-[#7a8899] mb-1">Tipo de pessoa</span>
              <select value={pagadorForm.tipo_pessoa} onChange={e => setPagador('tipo_pessoa', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] bg-white">
                <option value="">— Selecione —</option>
                <option value="fisica">Física</option>
                <option value="juridica">Jurídica</option>
              </select>
            </div>
            <div>
              <span className="block text-[11px] font-medium text-[#7a8899] mb-1">CEP</span>
              <input value={pagadorForm.cep} onChange={e => setPagador('cep', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] bg-white" />
            </div>
            <div>
              <span className="block text-[11px] font-medium text-[#7a8899] mb-1">UF</span>
              <input value={pagadorForm.uf} onChange={e => setPagador('uf', e.target.value.toUpperCase())} maxLength={2} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] bg-white" />
            </div>
            <div className="col-span-2">
              <span className="block text-[11px] font-medium text-[#7a8899] mb-1">Endereço</span>
              <input value={pagadorForm.endereco} onChange={e => setPagador('endereco', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] bg-white" />
            </div>
            <div>
              <span className="block text-[11px] font-medium text-[#7a8899] mb-1">Número</span>
              <input value={pagadorForm.numero} onChange={e => setPagador('numero', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] bg-white" />
            </div>
            <div>
              <span className="block text-[11px] font-medium text-[#7a8899] mb-1">Complemento</span>
              <input value={pagadorForm.complemento} onChange={e => setPagador('complemento', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] bg-white" />
            </div>
            <div>
              <span className="block text-[11px] font-medium text-[#7a8899] mb-1">Bairro</span>
              <input value={pagadorForm.bairro} onChange={e => setPagador('bairro', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] bg-white" />
            </div>
            <div>
              <span className="block text-[11px] font-medium text-[#7a8899] mb-1">Cidade</span>
              <input value={pagadorForm.cidade} onChange={e => setPagador('cidade', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] bg-white" />
            </div>
          </div>
        </div>
      )}
      <label className="space-y-1 md:col-span-2">
        <span className="text-[12px] font-medium text-[#34495e]">Processo vinculado</span>
        <select value={form.processo_id} onChange={e => set('processo_id', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] bg-white">
          <option value="">Sem processo</option>
          {processos.map(p => <option key={p.id} value={p.id}>{p.numero_processo ?? p.titulo ?? p.id}</option>)}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-[12px] font-medium text-[#34495e]">Valor (mínimo R$ 2,50)</span>
        <input
          value={form.valor}
          onChange={e => set('valor', e.target.value)}
          placeholder="1500,00"
          disabled={recorrente && form.tipo_caso === 'partido' && !!form.valor_variavel}
          className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] disabled:bg-[#F7F9F9] disabled:text-[#9aa5b1]"
        />
        {recorrente && form.tipo_caso === 'partido' && form.valor_variavel && (
          <span className="block text-[11px] text-[#7a8899]">Ignorado — use os valores por parcela abaixo.</span>
        )}
      </label>
      <label className="space-y-1">
        <span className="text-[12px] font-medium text-[#34495e]">{recorrente ? 'Vencimento inicial' : 'Vencimento'}</span>
        <input type="date" value={recorrente ? form.data_vencimento_inicial : form.data_vencimento} onChange={e => set(recorrente ? 'data_vencimento_inicial' : 'data_vencimento', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px]" />
      </label>
      {recorrente && (
        <>
          <label className="space-y-1">
            <span className="text-[12px] font-medium text-[#34495e]">Quantidade de parcelas</span>
            <input type="number" min="1" max="120" value={form.quantidade_parcelas} onChange={e => set('quantidade_parcelas', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px]" />
          </label>
          <label className="space-y-1">
            <span className="text-[12px] font-medium text-[#34495e]">Dia de vencimento</span>
            <input type="number" min="1" max="31" value={form.dia_vencimento} onChange={e => set('dia_vencimento', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px]" />
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-[12px] font-medium text-[#34495e]">Tipo de contrato</span>
            <select
              value={form.tipo_caso ?? ''}
              onChange={e => setForm(prev => ({ ...prev, tipo_caso: e.target.value as TipoCaso }))}
              className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] bg-white"
            >
              <option value="">— Selecione —</option>
              <option value="isolado">Ação isolada</option>
              <option value="partido">Advocacia de partido</option>
            </select>
          </label>

          {form.tipo_caso === 'isolado' && (
            <label className="space-y-1 md:col-span-2">
              <span className="text-[12px] font-medium text-[#34495e]">% de êxito</span>
              <input
                value={form.percentual_exito ?? ''}
                onChange={e => set('percentual_exito', e.target.value)}
                placeholder="Ex.: 20%"
                className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px]"
              />
            </label>
          )}

          {form.tipo_caso === 'partido' && (
            <div className="md:col-span-2 rounded-lg border border-[#e8edf2] bg-[#F7F9F9] p-3 space-y-3">
              {!form.valor_variavel && (
                <label className="flex items-center gap-2 text-[13px] text-[#34495e]">
                  <input
                    type="checkbox"
                    checked={!!form.parcela_extra_dezembro}
                    onChange={e => setForm(prev => ({ ...prev, parcela_extra_dezembro: e.target.checked }))}
                  />
                  Mensalidade em dobro em dezembro
                </label>
              )}

              <label className="space-y-1">
                <span className="text-[12px] font-medium text-[#34495e]">Valores ao longo do contrato</span>
                <select
                  value={form.valor_variavel ? 'variam' : 'fixo'}
                  onChange={e => setForm(prev => ({ ...prev, valor_variavel: e.target.value === 'variam' }))}
                  className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] bg-white"
                >
                  <option value="fixo">Valor fixo em todos os meses{form.parcela_extra_dezembro ? ' (exceto dezembro)' : ''}</option>
                  <option value="variam">Valores variam ao longo do contrato</option>
                </select>
              </label>

              {form.valor_variavel && (
                <div>
                  <p className="text-[11px] text-[#7a8899] mb-2">Informe o valor de cada uma das {form.quantidade_parcelas || 0} parcelas.</p>
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: Number(form.quantidade_parcelas) || 0 }).map((_, i) => (
                      <div key={i}>
                        <span className="block text-[11px] font-medium text-[#7a8899] mb-1">Parcela {i + 1}</span>
                        <input
                          value={form.valores_mensais?.[i] ?? ''}
                          onChange={e => {
                            const next = [...(form.valores_mensais ?? [])]
                            next[i] = e.target.value
                            setForm(prev => ({ ...prev, valores_mensais: next }))
                          }}
                          placeholder="0,00"
                          className="w-full px-2 py-1.5 rounded-lg border border-[#d8dee8] text-[13px]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
      <label className="space-y-1 md:col-span-2">
        <span className="text-[12px] font-medium text-[#34495e]">Descricao dos honorarios</span>
        <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] resize-none" />
      </label>
    </div>
  )
}
