'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Building2,
  Check,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  User,
  Users,
  Star,
  X,
} from 'lucide-react'
import type { ClienteContato } from '@/types'

type ContactFormState = {
  nome: string
  cargo: string
  area_responsavel: string
  celular: string
  email: string
  observacoes: string
  contato_principal: boolean
  ativo: boolean
  recebe_juridico: boolean
  recebe_financeiro: boolean
  recebe_documentos: boolean
  recebe_comunicados: boolean
}

type SendChannel = 'email' | 'whatsapp'

type SendPurpose = 'email' | 'mensagem' | 'comunicado' | 'relatorio' | 'documento' | 'cobranca'

type SendModalState = {
  channel: SendChannel
  preselectedIds: string[]
}

const PURPOSE_LABELS: Record<SendPurpose, string> = {
  email: 'E-mail',
  mensagem: 'Mensagem',
  comunicado: 'Comunicado',
  relatorio: 'Relatório',
  documento: 'Documento',
  cobranca: 'Cobrança',
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function normalizeText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function matchesSearch(contato: ClienteContato, search: string) {
  const needle = normalizeText(search)
  if (!needle) return true
  const haystack = [
    contato.nome,
    contato.cargo ?? '',
    contato.area_responsavel ?? '',
    contato.celular ?? '',
    contato.email ?? '',
    contato.observacoes ?? '',
  ].map(normalizeText).join(' | ')
  return haystack.includes(needle)
}

function contactToForm(contato?: ClienteContato | null): ContactFormState {
  return {
    nome: contato?.nome ?? '',
    cargo: contato?.cargo ?? '',
    area_responsavel: contato?.area_responsavel ?? '',
    celular: contato?.celular ?? '',
    email: contato?.email ?? '',
    observacoes: contato?.observacoes ?? '',
    contato_principal: contato?.contato_principal ?? false,
    ativo: contato?.ativo ?? true,
    recebe_juridico: contato?.recebe_juridico ?? false,
    recebe_financeiro: contato?.recebe_financeiro ?? false,
    recebe_documentos: contato?.recebe_documentos ?? false,
    recebe_comunicados: contato?.recebe_comunicados ?? false,
  }
}

function phoneLink(value: string | null) {
  const digits = onlyDigits(value ?? '')
  return digits.length >= 10 ? `https://wa.me/55${digits}` : ''
}

function mailtoLink(emails: string[], subject: string, body: string) {
  const to = emails.filter(Boolean).join(',')
  const params = new URLSearchParams()
  if (subject) params.set('subject', subject)
  if (body) params.set('body', body)
  return `mailto:${to}?${params.toString()}`
}

function EmptyState({ canEdit, onCreate }: { canEdit: boolean; onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#D8E1E6] bg-[#fbfcfd] p-6 text-center space-y-3">
      <Users size={24} className="mx-auto text-[#8ea1b2]" />
      <div>
        <p className="text-[14px] font-semibold text-[#0f1923]">Nenhum contato cadastrado</p>
        <p className="text-[12px] text-[#7a8899] mt-1">
          Cadastre as pessoas da empresa que recebem comunicações do escritório.
        </p>
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1D5F60] text-white text-[13px] font-medium hover:bg-[#27777A] transition-colors"
        >
          <Plus size={14} />
          Novo contato
        </button>
      )}
    </div>
  )
}

function ContactFormModal({
  open,
  onClose,
  clienteId,
  contato,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  clienteId: string
  contato?: ClienteContato | null
  onSaved: (item: ClienteContato) => void
}) {
  const [form, setForm] = useState<ContactFormState>(() => contactToForm(contato))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(contactToForm(contato))
    setError('')
    setSaving(false)
  }, [open, contato?.id])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.nome.trim()) {
      setError('Informe o nome do contato.')
      return
    }

    const payload = {
      nome: form.nome.trim(),
      cargo: form.cargo.trim(),
      area_responsavel: form.area_responsavel.trim(),
      celular: form.celular.trim(),
      email: form.email.trim(),
      observacoes: form.observacoes.trim(),
      contato_principal: form.contato_principal,
      ativo: form.ativo,
      recebe_juridico: form.recebe_juridico,
      recebe_financeiro: form.recebe_financeiro,
      recebe_documentos: form.recebe_documentos,
      recebe_comunicados: form.recebe_comunicados,
    }

    setSaving(true)
    try {
      const res = await fetch(
        contato
          ? `/api/clientes/${clienteId}/contatos/${contato.id}`
          : `/api/clientes/${clienteId}/contatos`,
        {
          method: contato ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error ?? 'Não foi possível salvar o contato.')
        return
      }

      onSaved(json as ClienteContato)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_24px_80px_rgba(13,34,53,0.18)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[#f9fbfc]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-copper)]">
              Contatos da empresa
            </p>
            <h3 className="text-[18px] font-semibold text-[var(--color-ink)]">
              {contato ? 'Editar contato' : 'Novo contato'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-[var(--color-border)] text-[var(--color-ink-2)] hover:bg-white"
          >
            <X size={16} className="mx-auto" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-2)]">Nome</span>
              <input
                value={form.nome}
                onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)]"
                placeholder="Nome da pessoa de contato"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-2)]">Cargo / função</span>
              <input
                value={form.cargo}
                onChange={(e) => setForm((prev) => ({ ...prev, cargo: e.target.value }))}
                className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)]"
                placeholder="Ex.: Diretora Jurídica"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-2)]">Área responsável</span>
              <input
                value={form.area_responsavel}
                onChange={(e) => setForm((prev) => ({ ...prev, area_responsavel: e.target.value }))}
                className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)]"
                placeholder="Ex.: Financeiro, Jurídico, RH"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-2)]">Celular / WhatsApp</span>
              <input
                value={form.celular}
                onChange={(e) => setForm((prev) => ({ ...prev, celular: e.target.value }))}
                className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)]"
                placeholder="(00) 00000-0000"
              />
            </label>

            <label className="space-y-1.5 md:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-2)]">E-mail</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)]"
                placeholder="contato@empresa.com.br"
              />
            </label>

            <label className="space-y-1.5 md:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-2)]">Observações</span>
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm((prev) => ({ ...prev, observacoes: e.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)] resize-none"
                placeholder="Observações internas sobre este contato"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
            {[
              ['contato_principal', 'Contato principal'],
              ['ativo', 'Ativo'],
              ['recebe_juridico', 'Recebe jurídico'],
              ['recebe_financeiro', 'Recebe financeiro/cobrança'],
              ['recebe_documentos', 'Recebe documentos'],
              ['recebe_comunicados', 'Recebe comunicados gerais'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2.5 bg-[#fafbfc]">
                <input
                  type="checkbox"
                  checked={Boolean((form as any)[key])}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.checked } as ContactFormState))}
                  className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-petrol)]"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          {error && <p className="text-[12px] text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-[13px] text-[var(--color-ink-2)] hover:bg-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-[var(--color-petrol)] text-white text-[13px] font-medium hover:bg-[var(--color-petrol-dark)] disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar contato'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SendModal({
  open,
  onClose,
  clienteNome,
  contacts,
  defaultChannel,
  preselectedIds,
}: {
  open: boolean
  onClose: () => void
  clienteNome: string
  contacts: ClienteContato[]
  defaultChannel: SendChannel
  preselectedIds: string[]
}) {
  const activeContacts = contacts.filter((c) => c.ativo)
  const [channel, setChannel] = useState<SendChannel>(defaultChannel)
  const [purpose, setPurpose] = useState<SendPurpose>('email')
  const [selectedIds, setSelectedIds] = useState<string[]>(
    () => preselectedIds.length > 0 ? preselectedIds : activeContacts.slice(0, 1).map((c) => c.id),
  )
  const [subject, setSubject] = useState(`Contato — ${clienteNome}`)
  const [body, setBody] = useState(`Olá,\n\nSegue comunicação referente a ${clienteNome}.\n\n`)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setChannel(defaultChannel)
    setSelectedIds(preselectedIds.length > 0 ? preselectedIds : activeContacts.slice(0, 1).map((c) => c.id))
    setSubject(`Contato — ${clienteNome}`)
    setBody(`Olá,\n\nSegue comunicação referente a ${clienteNome}.\n\n`)
    setError('')
  }, [open, defaultChannel, preselectedIds, activeContacts, clienteNome])

  if (!open) return null

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      if (channel === 'whatsapp') return [id]
      return prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    })
  }

  function openDraft() {
    setError('')
    const selected = activeContacts.filter((contact) => selectedIds.includes(contact.id))
    if (selected.length === 0) {
      setError('Selecione ao menos um contato.')
      return
    }

    if (channel === 'whatsapp') {
      const contact = selected[0]
      const link = phoneLink(contact.celular)
      if (!link) {
        setError('O contato selecionado não possui celular válido.')
        return
      }
      window.open(`${link}?text=${encodeURIComponent(body)}`, '_blank', 'noopener,noreferrer')
      return
    }

    const emails = selected.map((contact) => contact.email).filter((email): email is string => Boolean(email))
    if (emails.length === 0) {
      setError('Nenhum dos contatos selecionados possui e-mail válido.')
      return
    }

    const finalSubject = subject.trim() || `${PURPOSE_LABELS[purpose]} — ${clienteNome}`
    const finalBody = `${body.trim()}\n\n—\nEnviado a partir do cadastro do cliente ${clienteNome}`
    window.location.href = mailtoLink(emails, finalSubject, finalBody)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_24px_80px_rgba(13,34,53,0.18)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[#f9fbfc]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-copper)]">
              Selecionar destinatários
            </p>
            <h3 className="text-[18px] font-semibold text-[var(--color-ink)]">
              {channel === 'whatsapp' ? 'Enviar mensagem / WhatsApp' : 'Enviar e-mail'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-[var(--color-border)] text-[var(--color-ink-2)] hover:bg-white"
          >
            <X size={16} className="mx-auto" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-2)]">Canal</span>
              <select
                value={channel}
                onChange={(e) => {
                  const value = e.target.value as SendChannel
                  setChannel(value)
                  setSelectedIds(activeContacts.slice(0, 1).map((c) => c.id))
                }}
                className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)]"
              >
                <option value="email">E-mail</option>
                <option value="whatsapp">Mensagem / WhatsApp</option>
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-2)]">Finalidade</span>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as SendPurpose)}
                className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)]"
              >
                {(Object.keys(PURPOSE_LABELS) as SendPurpose[]).map((key) => (
                  <option key={key} value={key}>{PURPOSE_LABELS[key]}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 md:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-2)]">
                {channel === 'whatsapp' ? 'Mensagem' : 'Assunto'}
              </span>
              <input
                value={channel === 'whatsapp' ? body : subject}
                onChange={(e) => channel === 'whatsapp' ? setBody(e.target.value) : setSubject(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)]"
                placeholder={channel === 'whatsapp' ? 'Texto que será aberto no WhatsApp' : 'Assunto do e-mail'}
              />
            </label>

            <label className="space-y-1.5 md:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-2)]">
                {channel === 'whatsapp' ? 'Texto da mensagem' : 'Corpo do e-mail'}
              </span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-copper)] resize-none"
                placeholder="Escreva a mensagem que será aberta em rascunho"
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-semibold text-[var(--color-ink-2)] uppercase tracking-[0.08em]">
                Contatos ativos
              </p>
              {channel === 'whatsapp' && (
                <p className="text-[11px] text-[#7a8899]">WhatsApp abre um contato por vez.</p>
              )}
            </div>
            <div className="max-h-60 overflow-y-auto rounded-2xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
              {activeContacts.map((contact) => {
                const checked = selectedIds.includes(contact.id)
                const disabled = channel === 'whatsapp' && !checked && selectedIds.length >= 1
                return (
                  <label
                    key={contact.id}
                    className={`flex items-center gap-3 px-4 py-3 ${disabled ? 'opacity-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleSelected(contact.id)}
                      className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-petrol)]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[var(--color-ink)] truncate">{contact.nome}</p>
                      <p className="text-[11px] text-[#7a8899] truncate">
                        {contact.email || 'Sem e-mail'} · {contact.celular || 'Sem celular'}
                      </p>
                    </div>
                    {contact.contato_principal && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#E8F2F2] text-[#1D5F60]">
                        Principal
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </div>

          {error && <p className="text-[12px] text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-[13px] text-[var(--color-ink-2)] hover:bg-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={openDraft}
              className="px-4 py-2 rounded-xl bg-[var(--color-petrol)] text-white text-[13px] font-medium hover:bg-[var(--color-petrol-dark)] inline-flex items-center gap-1.5"
            >
              {channel === 'whatsapp' ? <MessageCircle size={14} /> : <Mail size={14} />}
              {channel === 'whatsapp' ? 'Abrir WhatsApp' : 'Abrir rascunho'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ContatosEmpresaTab({
  clienteId,
  clienteNome,
  pessoaJuridica,
  canEdit,
  initialContatos,
}: {
  clienteId: string
  clienteNome: string
  pessoaJuridica: boolean
  canEdit: boolean
  initialContatos: ClienteContato[]
}) {
  const [contatos, setContatos] = useState<ClienteContato[]>(initialContatos)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [contactModal, setContactModal] = useState<ClienteContato | null | undefined>(undefined)
  const [sendModal, setSendModal] = useState<SendModalState | null>(null)

  const title = pessoaJuridica ? 'Contatos da empresa' : 'Contatos relacionados'
  const subtitle = pessoaJuridica
    ? 'Cadastre pessoas de contato da empresa e defina quem recebe jurídico, financeiro, documentos e comunicados.'
    : 'Mantenha contatos relacionados para comunicações e organização interna.'

  const activeContacts = useMemo(
    () => contatos.filter((contato) => contato.ativo).filter((contato) => matchesSearch(contato, search)),
    [contatos, search],
  )
  const inactiveContacts = useMemo(
    () => contatos.filter((contato) => !contato.ativo).filter((contato) => matchesSearch(contato, search)),
    [contatos, search],
  )

  async function persistContact(contact: ClienteContato) {
    setContatos((prev) => {
      const index = prev.findIndex((item) => item.id === contact.id)
      if (index === -1) return [contact, ...prev]
      const next = [...prev]
      next[index] = contact
      return next
    })
  }

  async function handleDelete(contact: ClienteContato) {
    if (!window.confirm(`Excluir o contato ${contact.nome}?`)) return

    const res = await fetch(`/api/clientes/${clienteId}/contatos/${contact.id}`, {
      method: 'DELETE',
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      window.alert(json?.error ?? 'Não foi possível excluir o contato.')
      return
    }

    setContatos((prev) => prev.filter((item) => item.id !== contact.id))
  }

  async function handleToggleActive(contact: ClienteContato) {
    const res = await fetch(`/api/clientes/${clienteId}/contatos/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ativo: !contact.ativo,
        contato_principal: contact.ativo ? false : contact.contato_principal,
      }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      window.alert(json?.error ?? 'Não foi possível alterar o status do contato.')
      return
    }
    persistContact(json as ClienteContato)
  }

  const selectedSendContacts = sendModal
    ? contatos.filter((contato) => contato.ativo)
    : []

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-copper)]">
              {title}
            </p>
            <h3 className="text-[20px] font-semibold text-[var(--color-ink)]">{title}</h3>
            <p className="text-[13px] text-[var(--color-ink-3)] mt-1 max-w-3xl">
              {subtitle}
            </p>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSendModal({ channel: 'email', preselectedIds: activeContacts.slice(0, 1).map((c) => c.id) })}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--color-border)] text-[13px] text-[var(--color-ink-2)] hover:bg-white"
              >
                <Mail size={14} />
                Enviar e-mail
              </button>
              <button
                type="button"
                onClick={() => setSendModal({ channel: 'whatsapp', preselectedIds: activeContacts.slice(0, 1).map((c) => c.id) })}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--color-border)] text-[13px] text-[var(--color-ink-2)] hover:bg-white"
              >
                <MessageCircle size={14} />
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setContactModal(null)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--color-petrol)] text-white text-[13px] font-medium hover:bg-[var(--color-petrol-dark)]"
              >
                <Plus size={14} />
                Novo contato
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.08em] text-[#7a8899]">Ativos</p>
            <p className="text-[20px] font-semibold text-[var(--color-ink)]">{activeContacts.length}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.08em] text-[#7a8899]">Inativos</p>
            <p className="text-[20px] font-semibold text-[var(--color-ink)]">{inactiveContacts.length}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.08em] text-[#7a8899]">Jurídico</p>
            <p className="text-[20px] font-semibold text-[var(--color-ink)]">
              {contatos.filter((c) => c.recebe_juridico).length}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.08em] text-[#7a8899]">Principal</p>
            <p className="text-[20px] font-semibold text-[var(--color-ink)]">
              {contatos.some((c) => c.contato_principal) ? '1' : '—'}
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5">
          <Search size={14} className="text-[#7a8899]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-[13px] outline-none"
            placeholder="Buscar por nome, cargo, área, e-mail ou celular"
          />
        </label>

        <button
          type="button"
          onClick={() => setShowInactive((value) => !value)}
          className="text-[12px] text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
        >
          {showInactive ? 'Ocultar contatos inativos' : 'Mostrar contatos inativos'}
        </button>
      </div>

      <div className="space-y-4">
        {activeContacts.length === 0 ? (
          <EmptyState canEdit={canEdit} onCreate={() => setContactModal(null)} />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {activeContacts.map((contato) => (
              <article
                key={contato.id}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-[16px] font-semibold text-[var(--color-ink)] truncate">{contato.nome}</h4>
                      {contato.contato_principal && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-[#E8F2F2] text-[#1D5F60]">
                          <Star size={11} />
                          Principal
                        </span>
                      )}
                      {contato.ativo ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-green-50 text-green-700">
                          <CheckCircle2 size={11} />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-zinc-100 text-zinc-600">
                          Inativo
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[var(--color-ink-3)] mt-1">
                      {[contato.cargo, contato.area_responsavel].filter(Boolean).join(' · ') || 'Sem cargo/área informados'}
                    </p>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setContactModal(contato)}
                        className="w-9 h-9 rounded-xl border border-[var(--color-border)] text-[var(--color-ink-2)] hover:bg-white"
                      >
                        <Edit3 size={15} className="mx-auto" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(contato)}
                        className="w-9 h-9 rounded-xl border border-[var(--color-border)] text-[var(--color-ink-2)] hover:bg-white"
                        title={contato.ativo ? 'Desativar' : 'Ativar'}
                      >
                        {contato.ativo ? <ShieldCheck size={15} className="mx-auto" /> : <Check size={15} className="mx-auto" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(contato)}
                        className="w-9 h-9 rounded-xl border border-[var(--color-border)] text-red-600 hover:bg-red-50 disabled:opacity-50"
                        disabled={contato.contato_principal}
                        title={contato.contato_principal ? 'Troque o principal antes de excluir' : 'Excluir'}
                      >
                        <Trash2 size={15} className="mx-auto" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                  <div className="rounded-xl border border-[var(--color-border)] bg-[#fafbfc] p-3">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-[#7a8899] mb-1">Celular / WhatsApp</p>
                    <p className="text-[13px] text-[var(--color-ink)]">{contato.celular || '—'}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--color-border)] bg-[#fafbfc] p-3">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-[#7a8899] mb-1">E-mail</p>
                    <p className="text-[13px] text-[var(--color-ink)] break-all">{contato.email || '—'}</p>
                  </div>
                </div>

                {contato.observacoes && (
                  <div className="rounded-xl border border-[var(--color-border)] bg-[#fafbfc] p-3">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-[#7a8899] mb-1">Observações</p>
                    <p className="text-[13px] text-[var(--color-ink)] leading-relaxed">{contato.observacoes}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {contato.recebe_juridico && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#E8F2F2] text-[#1D5F60]">Jurídico</span>
                  )}
                  {contato.recebe_financeiro && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#eef2ff] text-[#3730a3]">Financeiro</span>
                  )}
                  {contato.recebe_documentos && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e]">Documentos</span>
                  )}
                  {contato.recebe_comunicados && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#ede9fe] text-[#6d28d9]">Comunicados</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSendModal({ channel: 'email', preselectedIds: [contato.id] })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--color-border)] text-[13px] text-[var(--color-ink-2)] hover:bg-white"
                  >
                    <Mail size={14} />
                    E-mail
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendModal({ channel: 'whatsapp', preselectedIds: [contato.id] })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--color-border)] text-[13px] text-[var(--color-ink-2)] hover:bg-white"
                    disabled={!contato.celular}
                    title={contato.celular ? 'Abrir WhatsApp' : 'Contato sem celular'}
                  >
                    <MessageCircle size={14} />
                    WhatsApp
                  </button>
                  <a
                    href={contato.email ? `mailto:${contato.email}` : '#'}
                    onClick={(e) => {
                      if (!contato.email) e.preventDefault()
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[13px] transition-colors ${
                      contato.email
                        ? 'border-[var(--color-border)] text-[var(--color-ink-2)] hover:bg-white'
                        : 'border-[var(--color-border)] text-[#c5cdd8] pointer-events-none'
                    }`}
                  >
                    <ExternalLink size={14} />
                    Abrir e-mail
                  </a>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1 text-[11px] text-[#7a8899]">
                  <p>
                    Criado por {contato.criado_por_profile?.nome ?? '—'} · {new Date(contato.created_at).toLocaleDateString('pt-BR')}
                  </p>
                  <p>
                    Atualizado em {new Date(contato.updated_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}

        {showInactive && inactiveContacts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-2)]">
                Contatos inativos
              </p>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {inactiveContacts.map((contato) => (
                <article
                  key={contato.id}
                  className="rounded-2xl border border-[var(--color-border)] bg-[#fafbfc] p-5 opacity-80 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-[15px] font-semibold text-[var(--color-ink)]">{contato.nome}</h4>
                      <p className="text-[12px] text-[#7a8899] mt-1">
                        {[contato.cargo, contato.area_responsavel].filter(Boolean).join(' · ') || 'Sem cargo/área informados'}
                      </p>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">Inativo</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>

      {canEdit && contactModal !== undefined && (
        <ContactFormModal
          open={contactModal !== undefined}
          onClose={() => setContactModal(undefined)}
          clienteId={clienteId}
          contato={contactModal ?? null}
          onSaved={(contact) => {
            persistContact(contact)
          }}
        />
      )}

      {sendModal && (
        <SendModal
          open
          onClose={() => setSendModal(null)}
          clienteNome={clienteNome}
          contacts={selectedSendContacts}
          defaultChannel={sendModal.channel}
          preselectedIds={sendModal.preselectedIds}
        />
      )}
    </div>
  )
}
