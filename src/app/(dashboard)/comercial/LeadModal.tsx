'use client'

import { useState, useEffect } from 'react'
import {
  X, Phone, Mail, User, DollarSign, Plus,
  CheckCircle, ChevronRight, Trash2, CalendarDays,
  ExternalLink, ArrowRight,
} from 'lucide-react'
import type {
  Lead, AtendimentoComercial, PropostaComercial,
  LeadOrigem, AtendimentoTipo, TipoContratacao,
} from '@/types/comercial'
import { ORIGEM_LABEL, STATUS_LABEL, TIPO_CONTRATACAO_LABEL } from '@/types/comercial'

interface Profile { id: string; nome: string }

interface Props {
  lead: Lead | null          // null = criar novo
  profiles: Profile[]
  currentUserId: string
  onClose: () => void
  onSaved: (lead: Lead) => void
  onDeleted?: (id: string) => void
}

type Tab = 'dados' | 'atendimentos' | 'propostas'

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Tela de sucesso pós-conversão ────────────────────────────────────────────
function ConversaoSucesso({ clienteId, clienteNome, onClose }: { clienteId: string; clienteNome: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-5">
      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
        <CheckCircle size={32} className="text-emerald-600" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-zinc-900">Lead convertido!</h3>
        <p className="text-sm text-zinc-500 mt-1.5">
          <span className="font-medium text-zinc-700">{clienteNome}</span> foi adicionado como cliente.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <a
          href={`/clientes/${clienteId}`}
          className="flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl bg-[#145A5B] text-white text-sm font-semibold hover:bg-[#0f4344] transition-colors"
        >
          <ExternalLink size={14} />
          Ver ficha do cliente
        </a>
        <button
          onClick={onClose}
          className="w-full px-5 py-2.5 rounded-xl border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  )
}

// ─── Modal de agendar reunião ─────────────────────────────────────────────────
function AgendarReuniaoModal({ lead, currentUserId, onClose, onAgendado }: {
  lead: Lead
  currentUserId: string
  onClose: () => void
  onAgendado: () => void
}) {
  const [data, setData]     = useState('')
  const [hora, setHora]     = useState('')
  const [titulo, setTitulo] = useState(`Reunião com ${lead.nome}`)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function handleSave() {
    if (!data) { setError('Data obrigatória'); return }
    setSaving(true); setError(null)
    try {
      // 1. Criar agenda_item
      const res = await fetch('/api/agenda-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          tipo:       'reuniao',
          status:     'pendente',
          prioridade: 'media',
          data_inicio: data,
          hora_inicio: hora || null,
          responsavel: currentUserId,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)

      // 2. Mover lead para reuniao_agendada (se ainda não estiver além disso)
      const leadRes = await fetch(`/api/comercial/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'reuniao_agendada' }),
      })
      if (!leadRes.ok) throw new Error((await leadRes.json()).error)

      onAgendado()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao agendar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-900">Agendar Reunião</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Título</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#145A5B]/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Data *</label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#145A5B]/30"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Horário</label>
              <input
                type="time"
                value={hora}
                onChange={e => setHora(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#145A5B]/30"
              />
            </div>
          </div>
          <p className="text-xs text-zinc-400 bg-zinc-50 px-3 py-2 rounded-lg">
            A reunião será adicionada à Agenda e o lead avançará para &ldquo;Reunião Agendada&rdquo;.
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 rounded-xl bg-[#145A5B] text-white text-sm font-semibold hover:bg-[#0f4344] transition-colors disabled:opacity-60">
            {saving ? 'Agendando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── LeadModal principal ──────────────────────────────────────────────────────
export default function LeadModal({ lead, profiles, currentUserId, onClose, onSaved, onDeleted }: Props) {
  const isNew = !lead

  const [tab, setTab]       = useState<Tab>('dados')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // Pós-conversão
  const [convertidoCliente, setConvertidoCliente] = useState<{ id: string; nome: string } | null>(null)

  // Agendar reunião
  const [showAgendarReuniaoModal, setShowAgendarReuniaoModal] = useState(false)

  // Form dados
  const [nome, setNome]                 = useState(lead?.nome ?? '')
  const [telefone, setTelefone]         = useState(lead?.telefone ?? '')
  const [email, setEmail]               = useState(lead?.email ?? '')
  const [origem, setOrigem]             = useState<LeadOrigem>(lead?.origem ?? 'indicacao')
  const [areaInteresse, setAreaInteresse] = useState(lead?.area_interesse ?? '')
  const [observacoes, setObservacoes]   = useState(lead?.observacoes ?? '')
  const [responsavelId, setResponsavelId] = useState(lead?.responsavel_id ?? currentUserId)
  const [valorEstimado, setValorEstimado] = useState(lead?.valor_estimado?.toString() ?? '')
  const [status, setStatus]             = useState(lead?.status ?? 'novo_lead')

  // Atendimentos
  const [atendimentos, setAtendimentos] = useState<AtendimentoComercial[]>(lead?.atendimentos ?? [])
  const [novoAtend, setNovoAtend]       = useState<{
    tipo: AtendimentoTipo; resumo: string; proxima_acao: string; data: string
  }>({ tipo: 'whatsapp', resumo: '', proxima_acao: '', data: new Date().toISOString().split('T')[0] })
  const [savingAtend, setSavingAtend]   = useState(false)

  // Propostas
  const [propostas, setPropostas]     = useState<PropostaComercial[]>(lead?.propostas ?? [])
  const [novaProp, setNovaProp]       = useState<{
    valor: string; descricao: string; tipo_contratacao: TipoContratacao; data_envio: string
  }>({ valor: '', descricao: '', tipo_contratacao: 'honorarios', data_envio: '' })
  const [savingProp, setSavingProp]   = useState(false)

  // Conversão
  const [convertendo, setConvertendo] = useState(false)

  // Carregar atendimentos e propostas ao abrir lead existente
  useEffect(() => {
    if (!lead?.id) return
    fetch(`/api/comercial/leads/${lead.id}`)
      .then(r => r.json())
      .then(d => {
        setAtendimentos(d.atendimentos ?? [])
        setPropostas(d.propostas ?? [])
      })
      .catch(() => {})
  }, [lead?.id])

  // ── Salvar dados ────────────────────────────────────────────────────────────
  async function handleSaveDados() {
    if (!nome.trim()) { setError('Nome obrigatório'); return }
    setSaving(true); setError(null)
    try {
      const body = {
        nome, telefone, email, origem,
        area_interesse: areaInteresse,
        observacoes,
        responsavel_id: responsavelId || null,
        valor_estimado: valorEstimado ? Number(valorEstimado) : null,
        status,
      }
      const res = await fetch(
        isNew ? '/api/comercial/leads' : `/api/comercial/leads/${lead!.id}`,
        { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSaved(data)
      if (isNew) onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  // ── Registrar atendimento ───────────────────────────────────────────────────
  async function handleAddAtendimento() {
    if (!novoAtend.resumo.trim()) return
    setSavingAtend(true)
    try {
      const res = await fetch('/api/comercial/atendimentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead!.id, ...novoAtend, responsavel_id: currentUserId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAtendimentos(prev => [data, ...prev])
      setNovoAtend({ tipo: 'whatsapp', resumo: '', proxima_acao: '', data: new Date().toISOString().split('T')[0] })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao registrar atendimento')
    } finally {
      setSavingAtend(false)
    }
  }

  // ── Criar proposta ──────────────────────────────────────────────────────────
  async function handleAddProposta() {
    if (!novaProp.valor) return
    setSavingProp(true)
    try {
      const res = await fetch('/api/comercial/propostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead!.id, ...novaProp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPropostas(prev => [data, ...prev])
      setNovaProp({ valor: '', descricao: '', tipo_contratacao: 'honorarios', data_envio: '' })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao criar proposta')
    } finally {
      setSavingProp(false)
    }
  }

  // ── Atualizar status de proposta ────────────────────────────────────────────
  async function handlePropostaStatus(id: string, newStatus: string) {
    const res = await fetch('/api/comercial/propostas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
    const data = await res.json()
    if (res.ok) setPropostas(prev => prev.map(p => p.id === id ? data : p))
  }

  // ── Converter em cliente ────────────────────────────────────────────────────
  async function handleConverter() {
    setConvertendo(true); setError(null)
    try {
      const res = await fetch(`/api/comercial/leads/${lead!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ converter_para_cliente: true, nome, email, telefone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSaved(data.lead)
      setConvertidoCliente({ id: data.cliente.id, nome: data.cliente.nome })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao converter')
    } finally {
      setConvertendo(false)
    }
  }

  // ── Excluir lead ────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!window.confirm(`Excluir lead "${lead?.nome}"? Esta ação é irreversível.`)) return
    const res = await fetch(`/api/comercial/leads/${lead!.id}`, { method: 'DELETE' })
    if (res.ok) { onDeleted?.(lead!.id); onClose() }
  }

  const jaConvertido = !!lead?.convertido_em

  // ── Tela de sucesso pós-conversão ───────────────────────────────────────────
  if (convertidoCliente) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <ConversaoSucesso
            clienteId={convertidoCliente.id}
            clienteNome={convertidoCliente.nome}
            onClose={onClose}
          />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

          {/* ── Header ── */}
          <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-zinc-100">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">
                {isNew ? 'Novo Lead' : nome || 'Lead'}
              </h2>
              {!isNew && (
                <p className="text-sm text-zinc-500 mt-0.5">{STATUS_LABEL[lead!.status]}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isNew && !jaConvertido && lead?.status !== 'perdido' && (
                <>
                  <button
                    onClick={() => setShowAgendarReuniaoModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 text-xs font-semibold hover:bg-purple-100 border border-purple-200 transition-colors"
                  >
                    <CalendarDays size={12} />
                    Agendar Reunião
                  </button>
                  <button
                    onClick={handleConverter}
                    disabled={convertendo}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60"
                  >
                    <ArrowRight size={13} />
                    {convertendo ? 'Convertendo…' : 'Converter em Cliente'}
                  </button>
                </>
              )}
              {jaConvertido && (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
                    Cliente convertido
                  </span>
                  {lead?.cliente && (
                    <a
                      href={`/clientes/${lead.cliente.id}`}
                      className="flex items-center gap-1 text-xs text-[#145A5B] hover:underline"
                    >
                      Ver cliente <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ── Tabs (só no modo edição) ── */}
          {!isNew && (
            <div className="flex border-b border-zinc-100 px-6">
              {([
                ['dados',        'Dados'],
                ['atendimentos', `Atendimentos (${atendimentos.length})`],
                ['propostas',    `Propostas (${propostas.length})`],
              ] as [Tab, string][]).map(([t, l]) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    tab === t ? 'border-[#145A5B] text-[#145A5B]' : 'border-transparent text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          )}

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>
            )}

            {/* ─ Tab: Dados ─ */}
            {(isNew || tab === 'dados') && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Nome *</label>
                    <input
                      value={nome}
                      onChange={e => setNome(e.target.value)}
                      className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#145A5B]/30"
                      placeholder="Nome completo"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">
                      <Phone size={11} className="inline mr-1" />Telefone
                    </label>
                    <input
                      value={telefone}
                      onChange={e => setTelefone(e.target.value)}
                      className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#145A5B]/30"
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">
                      <Mail size={11} className="inline mr-1" />E-mail
                    </label>
                    <input
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      type="email"
                      className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#145A5B]/30"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Origem</label>
                    <select
                      value={origem}
                      onChange={e => setOrigem(e.target.value as LeadOrigem)}
                      className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#145A5B]/30"
                    >
                      {Object.entries(ORIGEM_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">
                      <DollarSign size={11} className="inline mr-1" />Valor Estimado (R$)
                    </label>
                    <input
                      value={valorEstimado}
                      onChange={e => setValorEstimado(e.target.value)}
                      type="number"
                      min="0"
                      className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#145A5B]/30"
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Área de Interesse</label>
                    <input
                      value={areaInteresse}
                      onChange={e => setAreaInteresse(e.target.value)}
                      className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#145A5B]/30"
                      placeholder="Ex: Trabalhista, Família…"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">
                      <User size={11} className="inline mr-1" />Responsável
                    </label>
                    <select
                      value={responsavelId}
                      onChange={e => setResponsavelId(e.target.value)}
                      className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#145A5B]/30"
                    >
                      <option value="">Sem responsável</option>
                      {profiles.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </div>
                  {!isNew && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Status</label>
                      <select
                        value={status}
                        onChange={e => setStatus(e.target.value as Lead['status'])}
                        className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#145A5B]/30"
                      >
                        {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Observações</label>
                    <textarea
                      value={observacoes}
                      onChange={e => setObservacoes(e.target.value)}
                      rows={3}
                      className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#145A5B]/30 resize-none"
                      placeholder="Observações relevantes sobre o lead…"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ─ Tab: Atendimentos ─ */}
            {tab === 'atendimentos' && !isNew && (
              <div className="space-y-5">
                <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200 space-y-3">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Registrar Atendimento</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Tipo</label>
                      <select
                        value={novoAtend.tipo}
                        onChange={e => setNovoAtend(p => ({ ...p, tipo: e.target.value as AtendimentoTipo }))}
                        className="w-full border border-zinc-200 rounded-lg px-2 py-1.5 text-sm"
                      >
                        {(['whatsapp','telefone','reuniao','email','presencial','outro'] as AtendimentoTipo[]).map(t => (
                          <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Data</label>
                      <input
                        type="date"
                        value={novoAtend.data}
                        onChange={e => setNovoAtend(p => ({ ...p, data: e.target.value }))}
                        className="w-full border border-zinc-200 rounded-lg px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-zinc-500 mb-1">Resumo *</label>
                      <textarea
                        value={novoAtend.resumo}
                        onChange={e => setNovoAtend(p => ({ ...p, resumo: e.target.value }))}
                        rows={2}
                        className="w-full border border-zinc-200 rounded-lg px-2 py-1.5 text-sm resize-none"
                        placeholder="O que foi discutido…"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-zinc-500 mb-1">Próxima Ação</label>
                      <input
                        value={novoAtend.proxima_acao}
                        onChange={e => setNovoAtend(p => ({ ...p, proxima_acao: e.target.value }))}
                        className="w-full border border-zinc-200 rounded-lg px-2 py-1.5 text-sm"
                        placeholder="Ex: Ligar na semana que vem…"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleAddAtendimento}
                    disabled={savingAtend || !novoAtend.resumo.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#145A5B] text-white text-sm font-medium hover:bg-[#0f4344] transition-colors disabled:opacity-50"
                  >
                    <Plus size={14} />{savingAtend ? 'Registrando…' : 'Registrar'}
                  </button>
                </div>

                {atendimentos.length === 0 ? (
                  <p className="text-sm text-zinc-400 text-center py-6">Nenhum atendimento registrado ainda.</p>
                ) : (
                  <div className="space-y-3">
                    {atendimentos.map(a => (
                      <div key={a.id} className="border border-zinc-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md capitalize">
                              {a.tipo}
                            </span>
                            <span className="text-xs text-zinc-400">
                              {new Date(a.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          {a.responsavel && (
                            <span className="text-xs text-zinc-400">{a.responsavel.nome}</span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-700">{a.resumo}</p>
                        {a.proxima_acao && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                            <ChevronRight size={12} />{a.proxima_acao}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─ Tab: Propostas ─ */}
            {tab === 'propostas' && !isNew && (
              <div className="space-y-5">
                <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200 space-y-3">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Nova Proposta</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Valor (R$) *</label>
                      <input
                        type="number"
                        min="0"
                        value={novaProp.valor}
                        onChange={e => setNovaProp(p => ({ ...p, valor: e.target.value }))}
                        className="w-full border border-zinc-200 rounded-lg px-2 py-1.5 text-sm"
                        placeholder="5000"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Tipo de Contratação</label>
                      <select
                        value={novaProp.tipo_contratacao}
                        onChange={e => setNovaProp(p => ({ ...p, tipo_contratacao: e.target.value as TipoContratacao }))}
                        className="w-full border border-zinc-200 rounded-lg px-2 py-1.5 text-sm"
                      >
                        {Object.entries(TIPO_CONTRATACAO_LABEL).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Data de Envio</label>
                      <input
                        type="date"
                        value={novaProp.data_envio}
                        onChange={e => setNovaProp(p => ({ ...p, data_envio: e.target.value }))}
                        className="w-full border border-zinc-200 rounded-lg px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-zinc-500 mb-1">Descrição / Escopo</label>
                      <textarea
                        value={novaProp.descricao}
                        onChange={e => setNovaProp(p => ({ ...p, descricao: e.target.value }))}
                        rows={2}
                        className="w-full border border-zinc-200 rounded-lg px-2 py-1.5 text-sm resize-none"
                        placeholder="Escopo da proposta…"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleAddProposta}
                    disabled={savingProp || !novaProp.valor}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#145A5B] text-white text-sm font-medium hover:bg-[#0f4344] transition-colors disabled:opacity-50"
                  >
                    <Plus size={14} />{savingProp ? 'Criando…' : 'Criar Proposta'}
                  </button>
                </div>

                {propostas.length === 0 ? (
                  <p className="text-sm text-zinc-400 text-center py-6">Nenhuma proposta criada ainda.</p>
                ) : (
                  <div className="space-y-3">
                    {propostas.map(p => (
                      <div key={p.id} className="border border-zinc-200 rounded-xl p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-base font-semibold text-zinc-900">{formatBRL(p.valor)}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {TIPO_CONTRATACAO_LABEL[p.tipo_contratacao]}
                              {p.data_envio && ` · Enviada em ${new Date(p.data_envio + 'T00:00:00').toLocaleDateString('pt-BR')}`}
                            </p>
                            {p.descricao && <p className="text-sm text-zinc-600 mt-1.5">{p.descricao}</p>}
                          </div>
                          <span className={`text-xs font-medium px-2 py-1 rounded-md shrink-0 ${
                            p.status === 'aceita'        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : p.status === 'recusada'   ? 'bg-red-50 text-red-700 border border-red-200'
                            : p.status === 'enviada'    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            :                             'bg-zinc-100 text-zinc-600'
                          }`}>
                            {p.status === 'em_elaboracao' ? 'Em Elaboração'
                              : p.status === 'enviada'  ? 'Enviada'
                              : p.status === 'aceita'   ? 'Aceita'
                              :                           'Recusada'}
                          </span>
                        </div>
                        {p.status !== 'aceita' && p.status !== 'recusada' && (
                          <div className="flex gap-2 mt-3">
                            {p.status === 'em_elaboracao' && (
                              <button
                                onClick={() => handlePropostaStatus(p.id, 'enviada')}
                                className="text-xs px-3 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                              >
                                Marcar como enviada
                              </button>
                            )}
                            <button
                              onClick={() => handlePropostaStatus(p.id, 'aceita')}
                              className="text-xs px-3 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                            >
                              Aceita
                            </button>
                            <button
                              onClick={() => handlePropostaStatus(p.id, 'recusada')}
                              className="text-xs px-3 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors"
                            >
                              Recusada
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="px-6 py-4 border-t border-zinc-100 flex items-center">
            {!isNew && onDeleted ? (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                <Trash2 size={14} />Excluir lead
              </button>
            ) : <span />}

            {(isNew || tab === 'dados') && (
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveDados}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#145A5B] text-white text-sm font-medium hover:bg-[#0f4344] transition-colors disabled:opacity-60"
                >
                  {saving ? 'Salvando…' : isNew ? 'Criar Lead' : 'Salvar'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal de agendar reunião ── */}
      {showAgendarReuniaoModal && lead && (
        <AgendarReuniaoModal
          lead={lead}
          currentUserId={currentUserId}
          onClose={() => setShowAgendarReuniaoModal(false)}
          onAgendado={() => {
            // Atualizar status do lead localmente
            onSaved({ ...lead, status: 'reuniao_agendada' })
          }}
        />
      )}
    </>
  )
}
