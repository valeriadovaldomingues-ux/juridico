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
import type { UserRole } from '@/types'
import type { Cobranca, CobrancaStatus } from '@/types/cobrancas'

interface ClienteOpcao {
  id: string
  nome: string
  cpf_cnpj: string | null
  email: string | null
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

type ChargeFormValues = {
  cliente_id: string
  processo_id: string
  valor: string
  descricao: string
  data_vencimento?: string
  data_vencimento_inicial?: string
  quantidade_parcelas?: string
  dia_vencimento?: string
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

const emptyRecorrente = {
  cliente_id: '',
  processo_id: '',
  valor: '',
  data_vencimento_inicial: new Date().toISOString().slice(0, 10),
  quantidade_parcelas: '12',
  dia_vencimento: String(new Date().getDate()),
  descricao: '',
}

export default function CobrancasPage({ initialCobrancas, clientes, processos, role }: Props) {
  const [cobrancas, setCobrancas] = useState(initialCobrancas)
  const [selectedId, setSelectedId] = useState(initialCobrancas[0]?.id ?? '')
  const [modal, setModal] = useState<'unica' | 'recorrente' | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [recorrente, setRecorrente] = useState(emptyRecorrente)
  const [status, setStatus] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [mes, setMes] = useState('')
  const [busca, setBusca] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
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

  async function createSingle() {
    setSaving(true)
    setError(null)
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
    setModal(null)
  }

  async function createRecurring() {
    setSaving(true)
    setError(null)
    const payload = {
      ...recorrente,
      valor: Number(recorrente.valor.replace(',', '.')),
      quantidade_parcelas: Number(recorrente.quantidade_parcelas),
      dia_vencimento: Number(recorrente.dia_vencimento),
      processo_id: recorrente.processo_id || null,
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
    setModal(null)
  }

  async function emitirInter(cobranca: Cobranca) {
    setBusyId(cobranca.id)
    setError(null)
    const res = await fetch(`/api/financeiro/cobrancas/${cobranca.id}/emitir-inter`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setBusyId(null)
    if (!res.ok) {
      setError(data.error ?? 'Erro ao emitir no Inter.')
      if (data.id) setCobrancas(prev => prev.map(c => c.id === data.id ? data : c))
      return
    }
    setCobrancas(prev => prev.map(c => c.id === data.id ? data : c))
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

              {selected.boleto_pdf_url && (
                <a
                  href={selected.boleto_pdf_url}
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
                <button onClick={() => emitirInter(selected)} disabled={busyId === selected.id || selected.status === 'paga'} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#0F3D3E] text-white text-[13px] font-medium disabled:opacity-60">
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
}: {
  form: ChargeFormValues
  setForm: React.Dispatch<React.SetStateAction<ChargeFormValues>>
  clientes: ClienteOpcao[]
  processos: ProcessoOpcao[]
  recorrente: boolean
}) {
  const set = (key: keyof ChargeFormValues, value: string) => setForm(prev => ({ ...prev, [key]: value }))
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <label className="space-y-1 md:col-span-2">
        <span className="text-[12px] font-medium text-[#34495e]">Cliente</span>
        <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] bg-white">
          <option value="">Selecione</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </label>
      <label className="space-y-1 md:col-span-2">
        <span className="text-[12px] font-medium text-[#34495e]">Processo vinculado</span>
        <select value={form.processo_id} onChange={e => set('processo_id', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] bg-white">
          <option value="">Sem processo</option>
          {processos.map(p => <option key={p.id} value={p.id}>{p.numero_processo ?? p.titulo ?? p.id}</option>)}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-[12px] font-medium text-[#34495e]">Valor</span>
        <input value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="1500,00" className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px]" />
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
        </>
      )}
      <label className="space-y-1 md:col-span-2">
        <span className="text-[12px] font-medium text-[#34495e]">Descricao dos honorarios</span>
        <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] resize-none" />
      </label>
    </div>
  )
}
