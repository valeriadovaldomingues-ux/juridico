'use client'

import { useMemo, useState } from 'react'
import {
  AlertCircle, Stamp, Plus, Search, X, Loader2, Mail, Phone,
  Clock, CheckCircle2, XCircle, Archive, Ban, Trash2, Send,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import type { UserRole } from '@/types'
import type { InpiProcesso, InpiStatus, InpiTipo } from '@/types/inpi'
import { INPI_STATUS_LABEL, INPI_TIPO_LABEL, calcularDecenio } from '@/types/inpi'

interface ClienteOpcao {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  celular: string | null
}

interface Props {
  initialProcessos: InpiProcesso[]
  clientes: ClienteOpcao[]
  role: UserRole
}

type FormValues = {
  cliente_id: string
  numero_processo: string
  tipo: InpiTipo
  titulo: string
  natureza: string
  classe_nice: string
  procurador: string
  data_deposito: string
  observacoes: string
}

const emptyForm: FormValues = {
  cliente_id: '', numero_processo: '', tipo: 'marca', titulo: '',
  natureza: '', classe_nice: '', procurador: '', data_deposito: '', observacoes: '',
}

const statusCfg: Record<InpiStatus, { label: string; chip: string; dot: string; icon: React.ElementType }> = {
  em_andamento: { label: 'Em andamento', chip: 'bg-blue-50 text-blue-700',    dot: 'bg-blue-400',    icon: Clock },
  concedido:    { label: 'Concedido',    chip: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', icon: CheckCircle2 },
  extinto:      { label: 'Extinto',      chip: 'bg-red-50 text-red-700',      dot: 'bg-red-500',     icon: XCircle },
  arquivado:    { label: 'Arquivado',    chip: 'bg-zinc-100 text-zinc-600',   dot: 'bg-zinc-400',    icon: Archive },
  indeferido:   { label: 'Indeferido',   chip: 'bg-rose-50 text-rose-700',    dot: 'bg-rose-500',    icon: Ban },
}

export default function InpiPage({ initialProcessos, clientes, role }: Props) {
  const [processos, setProcessos] = useState(initialProcessos)
  const [selectedId, setSelectedId] = useState(initialProcessos[0]?.id ?? '')
  const [modal, setModal] = useState<'novo' | 'editar' | null>(null)
  const [form, setForm] = useState<FormValues>(emptyForm)
  const [status, setStatus] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [busca, setBusca] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [movModal, setMovModal] = useState(false)
  const [movForm, setMovForm] = useState({ rpi_data: new Date().toISOString().slice(0, 10), descricao: '', codigo_despacho: '' })
  const [deleteTarget, setDeleteTarget] = useState<InpiProcesso | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const podeCriar = role !== 'estagiario'
  const podeExcluir = role === 'socio'
  const selected = processos.find(p => p.id === selectedId) ?? processos[0] ?? null

  const filtrados = useMemo(() => {
    return processos.filter(p => {
      if (status && p.status !== status) return false
      if (clienteId && p.cliente_id !== clienteId) return false
      const haystack = `${p.titulo} ${p.numero_processo} ${p.cliente?.nome ?? ''}`.toLowerCase()
      if (busca && !haystack.includes(busca.toLowerCase())) return false
      return true
    })
  }, [processos, status, clienteId, busca])

  const metricas = useMemo(() => {
    const total = processos.length
    const andamento = processos.filter(p => p.status === 'em_andamento').length
    const concedidos = processos.filter(p => p.status === 'concedido').length
    let vencendo = 0
    let expirados = 0
    for (const p of processos) {
      if (p.status !== 'concedido' || !p.data_concessao) continue
      const d = calcularDecenio(p.data_concessao)
      if (d.expirado) expirados += 1
      else if (d.janelaRenovacao || d.janelaMulta) vencendo += 1
    }
    return { total, andamento, concedidos, vencendo, expirados }
  }, [processos])

  async function createProcesso() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/inpi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, cliente_id: form.cliente_id || null }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Erro ao criar processo INPI.'); return }
    setProcessos(prev => [data, ...prev])
    setSelectedId(data.id)
    setForm(emptyForm)
    setModal(null)
  }

  async function salvarEdicao() {
    if (!selected) return
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/inpi/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, cliente_id: form.cliente_id || null }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Erro ao salvar.'); return }
    setProcessos(prev => prev.map(p => p.id === data.id ? { ...data, movimentacoes: p.movimentacoes } : p))
    setModal(null)
  }

  function abrirEdicao() {
    if (!selected) return
    setForm({
      cliente_id: selected.cliente_id ?? '',
      numero_processo: selected.numero_processo,
      tipo: selected.tipo,
      titulo: selected.titulo,
      natureza: selected.natureza ?? '',
      classe_nice: selected.classe_nice ?? '',
      procurador: selected.procurador ?? '',
      data_deposito: selected.data_deposito ?? '',
      observacoes: selected.observacoes ?? '',
    })
    setModal('editar')
  }

  async function registrarMovimentacao() {
    if (!selected) return
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/inpi/${selected.id}/movimentacoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(movForm),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Erro ao registrar movimentação.'); return }
    setProcessos(prev => prev.map(p => p.id === selected.id
      ? { ...p, movimentacoes: [data, ...(p.movimentacoes ?? [])] }
      : p))
    setMovForm({ rpi_data: new Date().toISOString().slice(0, 10), descricao: '', codigo_despacho: '' })
    setMovModal(false)
    // Se o lançamento indicou concessão, o backend já atualizou o processo —
    // busca de novo pra refletir status/data_concessao sem esperar reload.
    if (/concess[ãa]o de registro/i.test(movForm.descricao) || movForm.codigo_despacho.trim().toUpperCase() === 'IPAS158') {
      const r = await fetch(`/api/inpi/${selected.id}`)
      const atualizado = await r.json().catch(() => null)
      if (r.ok && atualizado) setProcessos(prev => prev.map(p => p.id === selected.id ? { ...atualizado } : p))
    }
  }

  async function excluir() {
    if (!deleteTarget || deleteConfirm !== 'EXCLUIR') return
    setDeleting(true)
    setError(null)
    const res = await fetch(`/api/inpi/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Não foi possível excluir.')
      return
    }
    const next = processos.filter(p => p.id !== deleteTarget.id)
    setProcessos(next)
    setSelectedId(current => current === deleteTarget.id ? next[0]?.id ?? '' : current)
    setDeleteTarget(null)
    setDeleteConfirm('')
  }

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight flex items-center gap-2">
            <Stamp size={21} className="text-[#145A5B]" />
            INPI
          </h1>
          <p className="text-[13px] text-[#7a8899] mt-0.5">Marcas acompanhadas junto ao INPI — decênio, publicações da RPI e contato do cliente.</p>
        </div>
        {podeCriar && (
          <button onClick={() => { setForm(emptyForm); setModal('novo') }} className="inline-flex items-center gap-2 px-3 py-2 bg-[#0F3D3E] hover:bg-[#145A5B] text-white text-[13px] font-medium rounded-lg">
            <Plus size={15} />
            Nova marca
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
          <AlertCircle size={16} className="mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Metric label="Total" value={String(metricas.total)} />
        <Metric label="Em andamento" value={String(metricas.andamento)} />
        <Metric label="Concedidas" value={String(metricas.concedidos)} />
        <Metric label="Decênio vencendo" value={String(metricas.vencendo)} tone={metricas.vencendo > 0 ? 'warn' : undefined} />
        <Metric label="Vencidas" value={String(metricas.expirados)} tone={metricas.expirados > 0 ? 'danger' : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e8edf2] bg-white p-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por marca, número ou cliente" className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] outline-none focus:ring-2 focus:ring-[#0F3D3E]/15" />
            </div>
            <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] bg-white">
              <option value="">Todos status</option>
              {Object.entries(INPI_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)} className="px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] bg-white max-w-[220px]">
              <option value="">Todos clientes</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#e8edf2] bg-white">
            <table className="w-full text-left">
              <thead className="bg-[#F7F9F9] text-[11px] uppercase tracking-wide text-[#7a8899]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Marca</th>
                  <th className="px-4 py-3 font-semibold">Nº processo</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Decênio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2f5]">
                {filtrados.map(p => (
                  <tr key={p.id} onClick={() => setSelectedId(p.id)} className={cn('cursor-pointer hover:bg-[#F7F9F9]', selected?.id === p.id && 'bg-[#eef7f7]')}>
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-medium text-[#0f1923]">{p.titulo}</p>
                      <p className="text-[12px] text-[#7a8899]">{INPI_TIPO_LABEL[p.tipo]}</p>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#34495e]">{p.numero_processo}</td>
                    <td className="px-4 py-3 text-[13px] text-[#34495e]">{p.cliente?.nome ?? '—'}</td>
                    <td className="px-4 py-3"><StatusChip status={p.status} /></td>
                    <td className="px-4 py-3"><DecenioBadge processo={p} /></td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-[13px] text-[#7a8899]">Nenhum processo INPI encontrado.</td></tr>
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
                  <p className="text-[12px] text-[#7a8899]">{INPI_TIPO_LABEL[selected.tipo]}</p>
                  <h2 className="text-[16px] font-semibold text-[#0f1923] mt-0.5">{selected.titulo}</h2>
                  <p className="text-[12px] text-[#7a8899] mt-0.5">Nº {selected.numero_processo}</p>
                </div>
                <StatusChip status={selected.status} />
              </div>

              {selected.status === 'concedido' && selected.data_concessao && (
                <DecenioCard processo={selected} />
              )}

              <div className="rounded-lg bg-[#F7F9F9] border border-[#e8edf2] p-3 space-y-2">
                <p className="text-[12px] font-semibold text-[#34495e]">Cliente</p>
                <p className="text-[13px] font-medium text-[#0f1923]">{selected.cliente?.nome ?? 'Sem cliente vinculado'}</p>
                {selected.cliente?.email && (
                  <p className="flex items-center gap-1.5 text-[12px] text-[#5b6776]"><Mail size={13} />{selected.cliente.email}</p>
                )}
                {(selected.cliente?.telefone || selected.cliente?.celular) && (
                  <p className="flex items-center gap-1.5 text-[12px] text-[#5b6776]"><Phone size={13} />{selected.cliente.celular || selected.cliente.telefone}</p>
                )}
                {!selected.cliente && <p className="text-[12px] text-[#9aa5b1]">Edite o processo para vincular um cliente.</p>}
              </div>

              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <Info label="Natureza" value={selected.natureza || '—'} />
                <Info label="Classe (Nice)" value={selected.classe_nice || '—'} />
                <Info label="Procurador" value={selected.procurador || '—'} />
                <Info label="Depósito" value={selected.data_deposito ? formatDate(selected.data_deposito) : '—'} />
              </div>

              {selected.observacoes && (
                <div>
                  <p className="text-[12px] font-medium text-[#7a8899] mb-1">Observações</p>
                  <p className="text-[13px] text-[#34495e] whitespace-pre-wrap">{selected.observacoes}</p>
                </div>
              )}

              <div className="pt-2 border-t border-[#eef2f5]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-semibold text-[#34495e]">Movimentações</p>
                  {podeCriar && (
                    <button onClick={() => setMovModal(true)} className="text-[12px] text-[#145A5B] font-medium hover:underline">+ Registrar</button>
                  )}
                </div>
                <div className="space-y-2 max-h-[240px] overflow-y-auto">
                  {(selected.movimentacoes ?? []).map(m => (
                    <div key={m.id} className="rounded-lg border border-[#eef2f5] px-3 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-medium text-[#7a8899]">{formatDate(m.rpi_data)}{m.rpi_numero ? ` · RPI ${m.rpi_numero}` : ''}</p>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium', m.origem === 'rpi_auto' ? 'bg-sky-50 text-sky-700' : 'bg-zinc-100 text-zinc-600')}>
                          {m.origem === 'rpi_auto' ? 'RPI' : 'Manual'}
                        </span>
                      </div>
                      <p className="text-[13px] text-[#0f1923] mt-0.5">{m.descricao}</p>
                    </div>
                  ))}
                  {(!selected.movimentacoes || selected.movimentacoes.length === 0) && (
                    <p className="text-[12px] text-[#9aa5b1]">Nenhuma movimentação registrada ainda.</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 pt-2 border-t border-[#eef2f5]">
                {podeCriar && (
                  <button onClick={abrirEdicao} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#d8dee8] text-[#34495e] text-[13px] font-medium hover:bg-[#F7F9F9]">
                    Editar processo
                  </button>
                )}
                {podeExcluir && (
                  <button onClick={() => { setDeleteTarget(selected); setDeleteConfirm('') }} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-rose-200 text-rose-700 text-[13px] font-medium hover:bg-rose-50">
                    <Trash2 size={15} />
                    Excluir processo
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-[13px] text-[#7a8899]">Nenhum processo cadastrado ainda.</div>
          )}
        </aside>
      </div>

      {(modal === 'novo' || modal === 'editar') && (
        <div className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl border border-[#e8edf2]">
            <div className="px-5 py-4 border-b border-[#eef2f5] flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-[#0f1923]">{modal === 'novo' ? 'Nova marca' : 'Editar processo INPI'}</h2>
              <button onClick={() => setModal(null)}><X size={18} /></button>
            </div>
            <div className="p-5">
              <ProcessoForm form={form} setForm={setForm} clientes={clientes} />
            </div>
            <div className="px-5 py-4 border-t border-[#eef2f5] flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px]">Cancelar</button>
              <button onClick={modal === 'novo' ? createProcesso : salvarEdicao} disabled={saving} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0F3D3E] text-white text-[13px] font-medium disabled:opacity-60">
                {saving && <Loader2 size={15} className="animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {movModal && (
        <div className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl border border-[#e8edf2]">
            <div className="px-5 py-4 border-b border-[#eef2f5] flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-[#0f1923]">Registrar movimentação</h2>
              <button onClick={() => setMovModal(false)}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <label className="block space-y-1">
                <span className="text-[12px] font-medium text-[#34495e]">Data da publicação (RPI)</span>
                <input type="date" value={movForm.rpi_data} onChange={e => setMovForm(prev => ({ ...prev, rpi_data: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px]" />
              </label>
              <label className="block space-y-1">
                <span className="text-[12px] font-medium text-[#34495e]">Descrição do despacho</span>
                <input value={movForm.descricao} onChange={e => setMovForm(prev => ({ ...prev, descricao: e.target.value }))} placeholder="Ex.: Concessão de registro" className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px]" />
              </label>
              <label className="block space-y-1">
                <span className="text-[12px] font-medium text-[#34495e]">Código do despacho (opcional)</span>
                <input value={movForm.codigo_despacho} onChange={e => setMovForm(prev => ({ ...prev, codigo_despacho: e.target.value }))} placeholder="Ex.: IPAS158" className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px]" />
              </label>
            </div>
            <div className="px-5 py-4 border-t border-[#eef2f5] flex justify-end gap-2">
              <button onClick={() => setMovModal(false)} className="px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px]">Cancelar</button>
              <button onClick={registrarMovimentacao} disabled={saving} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0F3D3E] text-white text-[13px] font-medium disabled:opacity-60">
                {saving && <Loader2 size={15} className="animate-spin" />}
                <Send size={14} />
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl border border-[#e8edf2]">
            <div className="px-5 py-4 border-b border-[#eef2f5] flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-[#0f1923]">Excluir processo INPI</h2>
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
                Esta ação não poderá ser desfeita — o histórico de movimentações também será apagado.
              </div>
              <p className="text-[13px] text-[#34495e]"><span className="font-medium">{deleteTarget.titulo}</span> — nº {deleteTarget.numero_processo}</p>
              <label className="block space-y-1">
                <span className="text-[12px] font-medium text-[#34495e]">Digite EXCLUIR para confirmar</span>
                <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px]" />
              </label>
            </div>
            <div className="px-5 py-4 border-t border-[#eef2f5] flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px]">Cancelar</button>
              <button onClick={excluir} disabled={deleting || deleteConfirm !== 'EXCLUIR'} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-700 text-white text-[13px] font-medium disabled:opacity-60">
                {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'warn' | 'danger' }) {
  return (
    <div className={cn(
      'rounded-lg border p-4',
      tone === 'danger' ? 'border-rose-200 bg-rose-50' : tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-[#e8edf2] bg-white',
    )}>
      <p className="text-[12px] text-[#7a8899]">{label}</p>
      <p className={cn('text-[20px] font-semibold mt-1', tone === 'danger' ? 'text-rose-700' : tone === 'warn' ? 'text-amber-700' : 'text-[#0f1923]')}>{value}</p>
    </div>
  )
}

function StatusChip({ status }: { status: InpiStatus }) {
  const cfg = statusCfg[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium', cfg.chip)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

function DecenioBadge({ processo }: { processo: InpiProcesso }) {
  if (processo.status !== 'concedido' || !processo.data_concessao) return <span className="text-[12px] text-[#9aa5b1]">—</span>
  const d = calcularDecenio(processo.data_concessao)
  if (d.expirado) return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700"><AlertCircle size={10} />Vencido</span>
  if (d.janelaMulta) return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700"><AlertCircle size={10} />Prazo de multa</span>
  if (d.janelaRenovacao) return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700"><Clock size={10} />Renovar até {formatDate(d.vencimento.toISOString())}</span>
  return <span className="text-[12px] text-[#7a8899]">{formatDate(d.vencimento.toISOString())}</span>
}

function DecenioCard({ processo }: { processo: InpiProcesso }) {
  if (!processo.data_concessao) return null
  const d = calcularDecenio(processo.data_concessao)
  const tone = d.expirado ? 'danger' : (d.janelaMulta || d.janelaRenovacao) ? 'warn' : 'ok'
  return (
    <div className={cn(
      'rounded-lg border p-3',
      tone === 'danger' ? 'border-rose-200 bg-rose-50' : tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-[#e8edf2] bg-[#F7F9F9]',
    )}>
      <p className={cn('text-[12px] font-semibold', tone === 'danger' ? 'text-rose-700' : tone === 'warn' ? 'text-amber-700' : 'text-[#34495e]')}>
        Decênio {d.expirado ? 'vencido' : 'vence'} em {formatDate(d.vencimento.toISOString())}
      </p>
      <p className="text-[12px] text-[#5b6776] mt-1">
        {d.expirado
          ? 'Prazo de renovação com multa já passou — registro extinto.'
          : d.janelaMulta
            ? 'Vencido, mas ainda dá pra renovar pagando multa (até 6 meses após o vencimento).'
            : d.janelaRenovacao
              ? `Faltam ${d.diasRestantes} dias — já pode pedir a renovação.`
              : `Faltam ${d.diasRestantes} dias (renovação abre 1 ano antes do vencimento).`}
      </p>
    </div>
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

function ProcessoForm({ form, setForm, clientes }: {
  form: FormValues
  setForm: React.Dispatch<React.SetStateAction<FormValues>>
  clientes: ClienteOpcao[]
}) {
  const set = (key: keyof FormValues, value: string) => setForm(prev => ({ ...prev, [key]: value }))
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <label className="space-y-1 md:col-span-2">
        <span className="text-[12px] font-medium text-[#34495e]">Marca</span>
        <input value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Nome da marca" className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px]" />
      </label>
      <label className="space-y-1">
        <span className="text-[12px] font-medium text-[#34495e]">Número do processo (INPI)</span>
        <input value={form.numero_processo} onChange={e => set('numero_processo', e.target.value)} placeholder="9 dígitos" className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px]" />
      </label>
      <label className="space-y-1">
        <span className="text-[12px] font-medium text-[#34495e]">Cliente</span>
        <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] bg-white">
          <option value="">Selecione</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-[12px] font-medium text-[#34495e]">Natureza</span>
        <select value={form.natureza} onChange={e => set('natureza', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] bg-white">
          <option value="">— Selecione —</option>
          <option value="Nominativa">Nominativa</option>
          <option value="Figurativa">Figurativa</option>
          <option value="Mista">Mista</option>
          <option value="Tridimensional">Tridimensional</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-[12px] font-medium text-[#34495e]">Classe (Nice)</span>
        <input value={form.classe_nice} onChange={e => set('classe_nice', e.target.value)} placeholder="Ex.: 35" className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px]" />
      </label>
      <label className="space-y-1">
        <span className="text-[12px] font-medium text-[#34495e]">Data de depósito</span>
        <input type="date" value={form.data_deposito} onChange={e => set('data_deposito', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px]" />
      </label>
      <label className="space-y-1">
        <span className="text-[12px] font-medium text-[#34495e]">Procurador no INPI</span>
        <input value={form.procurador} onChange={e => set('procurador', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px]" />
      </label>
      <label className="space-y-1 md:col-span-2">
        <span className="text-[12px] font-medium text-[#34495e]">Observações</span>
        <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-[#d8dee8] text-[13px] resize-none" />
      </label>
    </div>
  )
}
