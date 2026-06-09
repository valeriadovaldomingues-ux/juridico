'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, MessageSquare, Pencil, Send, Sparkles, Trash2, X } from 'lucide-react'
import type { Cliente, UserRole } from '@/types'
import type {
  ComunicacaoInteligenteCanal,
  ComunicacaoInteligenteDraft,
  ComunicacaoInteligenteStatus,
  ComunicacaoInteligenteTipo,
} from '@/lib/comunicacao-inteligente'
import {
  buildWhatsAppMensagem,
  buildWhatsAppUrl,
  normalizeWhatsAppTelefone,
} from '@/lib/comunicacao-inteligente'
import { normalizeComunicaoCanal, normalizeComunicaoTipo } from '@/lib/comunicacao-inteligente/validation'

const ALLOWED_ROLES: UserRole[] = ['administrativo', 'advogado', 'gerente', 'socio']

const STATUS_LABELS: Record<ComunicacaoInteligenteStatus, string> = {
  pendente_aprovacao: 'Pendente de aprovação',
  em_edicao: 'Em edição',
  aprovada: 'Aprovada',
  enviada: 'Enviada',
  enviada_manual_whatsapp: 'Enviada via WhatsApp',
  descartada: 'Descartada',
}

const STATUS_CLASSES: Record<ComunicacaoInteligenteStatus, string> = {
  pendente_aprovacao: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  em_edicao: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  aprovada: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  enviada: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  enviada_manual_whatsapp: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  descartada: 'bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200',
}

interface Props {
  processoId: string
  processoTitulo: string
  role: UserRole
  cliente: Pick<Cliente, 'id' | 'nome' | 'celular' | 'telefone'> | null
  comunicacoesIniciais: ComunicacaoInteligenteDraft[]
  onChange: (items: ComunicacaoInteligenteDraft[]) => void
}

interface FormState {
  titulo: string
  tipo: ComunicacaoInteligenteTipo
  canal_destino: ComunicacaoInteligenteCanal
  resumoExecutivo: string
  oQueAconteceu: string
  oQueIssoSignifica: string
  proximosPassos: string
  acaoNecessariaCliente: string
  mensagemCliente: string
  observacoesInternas: string
  camposNaoEncontrados: string
  inconsistencias: string
}

interface WhatsAppDestinatario {
  id: string
  nome: string
  telefone: string
  origem: 'cliente' | 'contato'
}

function toListText(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean).join('\n')
  return typeof value === 'string' ? value : ''
}

function fromListText(value: string) {
  return value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
}

function buildForm(draft: ComunicacaoInteligenteDraft): FormState {
  return {
    titulo: draft.titulo,
    tipo: normalizeComunicaoTipo(draft.tipo),
    canal_destino: normalizeComunicaoCanal(draft.canal_destino),
    resumoExecutivo: draft.resumoExecutivo ?? '',
    oQueAconteceu: draft.oQueAconteceu ?? '',
    oQueIssoSignifica: draft.oQueIssoSignifica ?? '',
    proximosPassos: toListText(draft.proximosPassos),
    acaoNecessariaCliente: draft.acaoNecessariaCliente ?? '',
    mensagemCliente: draft.mensagemCliente ?? '',
    observacoesInternas: draft.observacoesInternas ?? '',
    camposNaoEncontrados: toListText(draft.camposNaoEncontrados),
    inconsistencias: toListText(draft.inconsistencias),
  }
}

function toPayload(form: FormState) {
  return {
    titulo: form.titulo,
    tipo: form.tipo,
    canal_destino: form.canal_destino,
    resumoExecutivo: form.resumoExecutivo,
    oQueAconteceu: form.oQueAconteceu,
    oQueIssoSignifica: form.oQueIssoSignifica,
    proximosPassos: fromListText(form.proximosPassos),
    acaoNecessariaCliente: form.acaoNecessariaCliente,
    mensagemCliente: form.mensagemCliente,
    observacoesInternas: form.observacoesInternas,
    camposNaoEncontrados: fromListText(form.camposNaoEncontrados),
    inconsistencias: fromListText(form.inconsistencias),
  }
}

function formatDateTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function normalizeRecipientPhone(phone: string) {
  return normalizeWhatsAppTelefone(phone)
}

function buildRecipientLabel(destinatario: WhatsAppDestinatario) {
  const suffix = destinatario.origem === 'contato' ? 'Contato' : 'Cliente'
  return `${destinatario.nome} • ${suffix} • ${destinatario.telefone}`
}

export default function ComunicacoesTab({
  processoId,
  processoTitulo,
  role,
  cliente,
  comunicacoesIniciais,
  onChange,
}: Props) {
  const [items, setItems] = useState(comunicacoesIniciais)
  const [selected, setSelected] = useState<ComunicacaoInteligenteDraft | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [whatsappSelected, setWhatsappSelected] = useState<ComunicacaoInteligenteDraft | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [whatsappOpen, setWhatsappOpen] = useState(false)
  const [whatsappBusy, setWhatsappBusy] = useState(false)
  const [whatsappLoadingRecipients, setWhatsappLoadingRecipients] = useState(false)
  const [whatsappError, setWhatsappError] = useState('')
  const [whatsappDestinatarios, setWhatsappDestinatarios] = useState<WhatsAppDestinatario[]>([])
  const [whatsappDestinatarioId, setWhatsappDestinatarioId] = useState('')
  const [whatsappStage, setWhatsappStage] = useState<'selecionar' | 'aguardando_confirmacao'>('selecionar')
  const [whatsappMensagemPreview, setWhatsappMensagemPreview] = useState('')
  const canManage = ALLOWED_ROLES.includes(role)

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')),
    [items],
  )

  const whatsappDestinatarioSelecionado = useMemo(
    () => whatsappDestinatarios.find(item => item.id === whatsappDestinatarioId) ?? null,
    [whatsappDestinatarios, whatsappDestinatarioId],
  )

  function syncItems(next: ComunicacaoInteligenteDraft[]) {
    setItems(next)
    onChange(next)
  }

  function openEditor(item: ComunicacaoInteligenteDraft) {
    setSelected(item)
    setForm(buildForm(item))
    setError('')
  }

  function closeEditor() {
    setSelected(null)
    setForm(null)
    setError('')
  }

  function openWhatsAppModal(item: ComunicacaoInteligenteDraft) {
    if (item.status !== 'aprovada') {
      setError('A comunicação precisa estar aprovada antes do envio via WhatsApp.')
      return
    }

    setWhatsappSelected(item)
    setWhatsappOpen(true)
    setWhatsappStage('selecionar')
    setWhatsappError('')
    setWhatsappBusy(false)
    setWhatsappDestinatarios([])
    setWhatsappDestinatarioId('')
    setWhatsappMensagemPreview('')
  }

  function closeWhatsAppModal() {
    setWhatsappOpen(false)
    setWhatsappError('')
    setWhatsappBusy(false)
    setWhatsappStage('selecionar')
    setWhatsappDestinatarios([])
    setWhatsappDestinatarioId('')
    setWhatsappMensagemPreview('')
    setWhatsappSelected(null)
  }

  async function carregarDestinatariosWhatsApp() {
    if (!cliente?.id || !cliente?.nome) {
      setWhatsappDestinatarios([])
      return
    }

    setWhatsappLoadingRecipients(true)
    setWhatsappError('')

    try {
      const recipients: WhatsAppDestinatario[] = []
      const seenPhones = new Set<string>()

      const addRecipient = (destinatario: WhatsAppDestinatario) => {
        const phone = normalizeRecipientPhone(destinatario.telefone)
        if (!phone || seenPhones.has(phone)) return
        seenPhones.add(phone)
        recipients.push({
          ...destinatario,
          telefone: phone,
        })
      }

      if (cliente.celular) {
        addRecipient({
          id: 'cliente-celular',
          nome: `${cliente.nome} (celular principal)`,
          telefone: cliente.celular,
          origem: 'cliente',
        })
      }

      if (cliente.telefone) {
        addRecipient({
          id: 'cliente-telefone',
          nome: `${cliente.nome} (telefone principal)`,
          telefone: cliente.telefone,
          origem: 'cliente',
        })
      }

      const response = await fetch(`/api/clientes/${cliente.id}/contatos`)
      if (response.ok) {
        const payload = await response.json().catch(() => null)
        const contatos = Array.isArray(payload?.items) ? payload.items : []

        contatos
          .filter((contato: { ativo?: boolean; celular?: string | null }) => contato?.ativo && contato.celular)
          .forEach((contato: { id: string; nome: string; celular: string }) => {
            addRecipient({
              id: contato.id,
              nome: contato.nome,
              telefone: contato.celular,
              origem: 'contato',
            })
          })
      }

      setWhatsappDestinatarios(recipients)
      setWhatsappDestinatarioId(current => current || recipients[0]?.id || '')
    } catch (loadError) {
      setWhatsappError(loadError instanceof Error ? loadError.message : 'Falha ao carregar destinatários.')
      setWhatsappDestinatarios([])
    } finally {
      setWhatsappLoadingRecipients(false)
    }
  }

  useEffect(() => {
    if (!whatsappOpen || !whatsappSelected) return
    void carregarDestinatariosWhatsApp()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whatsappOpen, whatsappSelected?.id, cliente?.id])

  async function gerarNovaComunicacao() {
    setLoading(true)
    setError('')

    const res = await fetch(`/api/processos/${processoId}/comunicacoes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tipo: 'relatorio',
        canal_destino: 'portal',
      }),
    })

    setLoading(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Falha ao gerar comunicação')
      return
    }

    const draft = await res.json() as ComunicacaoInteligenteDraft
    syncItems([draft, ...items.filter(item => item.id !== draft.id)])
    openEditor(draft)
  }

  async function salvarRascunho() {
    if (!selected || !form) return
    setSaving(true)
    setError('')

    const res = await fetch(`/api/processos/comunicacoes/${selected.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(toPayload(form)),
    })

    setSaving(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Falha ao salvar rascunho')
      return
    }

    const updated = await res.json() as ComunicacaoInteligenteDraft
    syncItems(items.map(item => item.id === updated.id ? updated : item))
    setSelected(updated)
    setForm(buildForm(updated))
  }

  async function aprovar() {
    if (!selected) return
    setSaving(true)
    setError('')

    const res = await fetch(`/api/processos/comunicacoes/${selected.id}/aprovar`, {
      method: 'POST',
    })

    setSaving(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Falha ao aprovar comunicação')
      return
    }

    const updated = await res.json() as ComunicacaoInteligenteDraft
    syncItems(items.map(item => item.id === updated.id ? updated : item))
    setSelected(updated)
    setForm(buildForm(updated))
  }

  async function enviarPortal() {
    if (!selected) return
    if (selected.status !== 'aprovada') {
      setError('A comunicação precisa estar aprovada antes do envio.')
      return
    }
    if (!confirm('Enviar esta comunicação ao portal do cliente?')) return

    setSaving(true)
    setError('')

    const res = await fetch(`/api/processos/comunicacoes/${selected.id}/enviar`, {
      method: 'POST',
    })

    setSaving(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Falha ao enviar comunicação')
      return
    }

    const updated = await res.json() as ComunicacaoInteligenteDraft
    syncItems(items.map(item => item.id === updated.id ? updated : item))
    setSelected(updated)
    setForm(buildForm(updated))
  }

  async function iniciarWhatsApp() {
    if (!whatsappSelected || whatsappSelected.status !== 'aprovada') {
      setWhatsappError('A comunicação precisa estar aprovada antes do envio via WhatsApp.')
      return
    }
    if (!whatsappDestinatarioSelecionado) {
      setWhatsappError('Selecione um destinatário válido.')
      return
    }

    const popup = window.open('', '_blank')
    const telefone = normalizeRecipientPhone(whatsappDestinatarioSelecionado.telefone)
    if (!telefone) {
      setWhatsappError('Telefone inválido.')
      popup?.close()
      return
    }

    setWhatsappBusy(true)
    setWhatsappError('')

    const mensagemPreview = buildWhatsAppMensagem(whatsappSelected)

    const res = await fetch(`/api/processos/comunicacoes/${whatsappSelected.id}/whatsapp/iniciar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        destinatario_tipo: whatsappDestinatarioSelecionado.origem,
        contato_id: whatsappDestinatarioSelecionado.origem === 'contato' ? whatsappDestinatarioSelecionado.id : null,
        telefone,
      }),
    })

    setWhatsappBusy(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setWhatsappError(body.error ?? 'Falha ao abrir o WhatsApp')
      popup?.close()
      return
    }

    const body = await res.json().catch(() => null)
    const url = typeof body?.url === 'string' ? body.url : buildWhatsAppUrl(telefone, mensagemPreview)
    if (!url) {
      setWhatsappError('Não foi possível montar o link do WhatsApp.')
      popup?.close()
      return
    }

    if (popup) {
      popup.location.href = url
      popup.focus?.()
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }

    setWhatsappStage('aguardando_confirmacao')
  }

  async function confirmarWhatsApp() {
    if (!whatsappSelected || whatsappSelected.status !== 'aprovada') {
      setWhatsappError('A comunicação precisa estar aprovada antes da confirmação.')
      return
    }
    if (!whatsappDestinatarioSelecionado) {
      setWhatsappError('Selecione um destinatário válido.')
      return
    }

    setWhatsappBusy(true)
    setWhatsappError('')

    const res = await fetch(`/api/processos/comunicacoes/${whatsappSelected.id}/whatsapp/confirmar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        destinatario_tipo: whatsappDestinatarioSelecionado.origem,
        contato_id: whatsappDestinatarioSelecionado.origem === 'contato' ? whatsappDestinatarioSelecionado.id : null,
        telefone: normalizeRecipientPhone(whatsappDestinatarioSelecionado.telefone),
      }),
    })

    setWhatsappBusy(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setWhatsappError(body.error ?? 'Falha ao confirmar envio')
      return
    }

    const updated = await res.json() as ComunicacaoInteligenteDraft
    syncItems(items.map(item => item.id === updated.id ? updated : item))
    setWhatsappSelected(updated)
    setWhatsappMensagemPreview(buildWhatsAppMensagem(updated))
    closeWhatsAppModal()
  }

  async function descartar(item: ComunicacaoInteligenteDraft) {
    if (!confirm('Descartar esta comunicação?')) return

    const res = await fetch(`/api/processos/comunicacoes/${item.id}`, {
      method: 'DELETE',
    })

    if (!res.ok && res.status !== 204) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Falha ao descartar comunicação')
      return
    }

    const updated = items.map(current => current.id === item.id
      ? { ...current, status: 'descartada' as ComunicacaoInteligenteStatus, visivel_portal: false }
      : current)
    syncItems(updated)
    if (selected?.id === item.id) {
      closeEditor()
    }
  }

  if (!canManage) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[#9ca3af]">Comunicação Inteligente</p>
          <h3 className="text-sm font-semibold text-[#1a1d23] mt-1">Área restrita</h3>
          <p className="text-[12px] text-[#6b7280] mt-1">
            Este módulo é visível apenas para usuários internos autorizados.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[#9ca3af]">Comunicação Inteligente</p>
          <h3 className="text-sm font-semibold text-[#1a1d23] mt-1">Relatórios e mensagens para o cliente</h3>
          <p className="text-[12px] text-[#6b7280] mt-1">
            Gere uma minuta com base nos andamentos do processo, revise manualmente e só então aprove ou envie ao portal.
          </p>
        </div>

        <button
          onClick={gerarNovaComunicacao}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-[#145A5B] px-3 py-2 text-[12px] font-medium text-white hover:bg-[#1B6E70] disabled:opacity-60"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          Gerar comunicação
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
          {error}
        </div>
      )}

      {sortedItems.length === 0 ? (
        <div className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-8 text-center">
          <p className="text-sm text-[#6b7280]">Nenhuma comunicação gerada para este processo.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedItems.map(item => (
            <div key={item.id} className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-[#E8F2F2] text-[#1D5F60]">
                      {item.tipo}
                    </span>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_CLASSES[item.status]}`}>
                      {STATUS_LABELS[item.status]}
                    </span>
                    <span className="text-[11px] text-[#9ca3af]">{formatDateTime(item.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#1a1d23]">{item.titulo}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-[#4b5563] line-clamp-3 whitespace-pre-line">
                    {item.conteudo_texto || item.mensagemCliente || item.resumoExecutivo || 'Sem conteúdo disponível.'}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {item.status === 'aprovada' && (
                    <button
                      onClick={() => openWhatsAppModal(item)}
                      className="rounded-lg p-2 text-[#6b7280] hover:bg-[#e8f2f2] hover:text-[#145A5B] transition-colors"
                      title="Enviar via WhatsApp"
                    >
                      <MessageSquare size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => openEditor(item)}
                    className="rounded-lg p-2 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1d23] transition-colors"
                    title="Revisar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => descartar(item)}
                    className="rounded-lg p-2 text-[#6b7280] hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Descartar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#9ca3af]">
                  {selected.status === 'pendente_aprovacao' ? 'Revisão do rascunho' : 'Editar comunicação'}
                </p>
                <h4 className="text-sm font-semibold text-[#1a1d23] mt-1">{processoTitulo}</h4>
              </div>
              <button onClick={closeEditor} className="rounded-full p-2 text-[#6b7280] hover:bg-[#f3f4f6]">
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-4 px-5 py-5 lg:grid-cols-2">
              <Field
                label="Título"
                value={form.titulo}
                onChange={value => setForm(prev => prev ? { ...prev, titulo: value } : prev)}
              />
              <Field
                label="Tipo"
                as="select"
                value={form.tipo}
                onChange={value => setForm(prev => prev ? { ...prev, tipo: normalizeComunicaoTipo(value) } : prev)}
                options={['relatorio', 'mensagem', 'atualizacao']}
              />
              <Field
                label="Canal"
                as="select"
                value={form.canal_destino}
                onChange={value => setForm(prev => prev ? { ...prev, canal_destino: normalizeComunicaoCanal(value) } : prev)}
                options={['portal', 'email', 'whatsapp']}
              />
              <Field label="Resumo executivo" value={form.resumoExecutivo} onChange={value => setForm(prev => prev ? { ...prev, resumoExecutivo: value } : prev)} textarea />
              <Field label="O que aconteceu" value={form.oQueAconteceu} onChange={value => setForm(prev => prev ? { ...prev, oQueAconteceu: value } : prev)} textarea />
              <Field label="O que isso significa" value={form.oQueIssoSignifica} onChange={value => setForm(prev => prev ? { ...prev, oQueIssoSignifica: value } : prev)} textarea />
              <Field label="Próximos passos" value={form.proximosPassos} onChange={value => setForm(prev => prev ? { ...prev, proximosPassos: value } : prev)} textarea />
              <Field label="Ação necessária do cliente" value={form.acaoNecessariaCliente} onChange={value => setForm(prev => prev ? { ...prev, acaoNecessariaCliente: value } : prev)} textarea />
              <Field label="Mensagem ao cliente" value={form.mensagemCliente} onChange={value => setForm(prev => prev ? { ...prev, mensagemCliente: value } : prev)} textarea />
              <Field label="Observações internas" value={form.observacoesInternas} onChange={value => setForm(prev => prev ? { ...prev, observacoesInternas: value } : prev)} textarea />
              <Field label="Campos não encontrados" value={form.camposNaoEncontrados} onChange={value => setForm(prev => prev ? { ...prev, camposNaoEncontrados: value } : prev)} textarea />
              <Field label="Inconsistências" value={form.inconsistencias} onChange={value => setForm(prev => prev ? { ...prev, inconsistencias: value } : prev)} textarea />
            </div>

            <div className="border-t border-[#e5e7eb] px-5 py-4">
              <p className="text-[12px] text-[#6b7280]">
                Revise os dados antes de aplicar. A extração automática pode conter erros.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={salvarRascunho}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] px-3 py-2 text-[12px] font-medium text-[#374151] hover:bg-[#f9fafb] disabled:opacity-60"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Salvar rascunho
                </button>
                <button
                  onClick={aprovar}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#145A5B] px-3 py-2 text-[12px] font-medium text-white hover:bg-[#1B6E70] disabled:opacity-60"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Aprovar
                </button>
                <button
                  onClick={enviarPortal}
                  disabled={saving || selected.status !== 'aprovada'}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0C1B2A] px-3 py-2 text-[12px] font-medium text-white hover:bg-[#12283f] disabled:opacity-60"
                >
                  <Send size={13} />
                  Enviar ao portal
                </button>
                <button
                  onClick={closeEditor}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-[#6b7280] hover:bg-[#f3f4f6]"
                >
                  <X size={13} />
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {whatsappOpen && whatsappSelected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#9ca3af]">Enviar via WhatsApp</p>
                <h4 className="text-sm font-semibold text-[#1a1d23] mt-1">{processoTitulo}</h4>
              </div>
              <button onClick={closeWhatsAppModal} className="rounded-full p-2 text-[#6b7280] hover:bg-[#f3f4f6]">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <p className="text-[13px] text-[#374151]">
                O WhatsApp será aberto em nova aba. Confirme depois se a mensagem foi enviada.
              </p>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-wider text-[#9ca3af]">
                      Destinatário
                    </label>
                    <select
                      value={whatsappDestinatarioId}
                      onChange={e => setWhatsappDestinatarioId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#1a1d23] outline-none focus:border-[#145A5B]"
                    >
                      {whatsappLoadingRecipients && <option value="">Carregando contatos...</option>}
                      {!whatsappLoadingRecipients && whatsappDestinatarios.length === 0 && (
                        <option value="">Nenhum telefone disponível</option>
                      )}
                      {whatsappDestinatarios.map(destinatario => (
                        <option key={destinatario.id} value={destinatario.id}>
                          {buildRecipientLabel(destinatario)}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[12px] text-[#6b7280]">
                      Use o celular principal do cliente ou um contato vinculado ativo.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[#9ca3af]">Mensagem preparada</p>
                    <div className="mt-2 max-h-60 overflow-y-auto whitespace-pre-line rounded-lg bg-white p-3 text-[13px] leading-relaxed text-[#1a1d23] border border-[#e5e7eb]">
                      {whatsappMensagemPreview || buildWhatsAppMensagem(whatsappSelected!)}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[#9ca3af]">Confirmação</p>
                    <p className="mt-2 text-[13px] text-[#374151]">
                      {whatsappStage === 'selecionar'
                        ? 'Selecione o destinatário e abra o WhatsApp.'
                        : 'Volte ao PEDV depois de enviar e confirme manualmente.'}
                    </p>
                    {whatsappDestinatarioSelecionado && (
                      <div className="mt-3 rounded-lg bg-[#f9fafb] p-3 text-[13px] text-[#1a1d23]">
                        <p className="font-medium">{whatsappDestinatarioSelecionado.nome}</p>
                        <p className="text-[#6b7280]">{whatsappDestinatarioSelecionado.telefone}</p>
                      </div>
                    )}
                  </div>

                  {whatsappError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
                      {whatsappError}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-[#e5e7eb] pt-4">
                <button
                  onClick={iniciarWhatsApp}
                  disabled={whatsappBusy || whatsappLoadingRecipients || whatsappDestinatarios.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#145A5B] px-3 py-2 text-[12px] font-medium text-white hover:bg-[#1B6E70] disabled:opacity-60"
                >
                  {whatsappBusy ? <Loader2 size={13} className="animate-spin" /> : <MessageSquare size={13} />}
                  Abrir WhatsApp
                </button>
                <button
                  onClick={confirmarWhatsApp}
                  disabled={whatsappBusy || whatsappStage !== 'aguardando_confirmacao' || whatsappDestinatarios.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0C1B2A] px-3 py-2 text-[12px] font-medium text-white hover:bg-[#12283f] disabled:opacity-60"
                >
                  <Check size={13} />
                  Confirmar envio
                </button>
                <button
                  onClick={closeWhatsAppModal}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-[#6b7280] hover:bg-[#f3f4f6]"
                >
                  <X size={13} />
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  textarea,
  as = 'input',
  options = [],
}: {
  label: string
  value: string
  onChange: (value: string) => void
  textarea?: boolean
  as?: 'input' | 'select'
  options?: string[]
}) {
  return (
    <label className="space-y-1.5">
      <span className="block text-[11px] font-medium uppercase tracking-wider text-[#9ca3af]">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#1a1d23] outline-none focus:border-[#1D5F60]"
        />
      ) : as === 'select' ? (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#1a1d23] outline-none focus:border-[#1D5F60]"
        >
          {options.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#1a1d23] outline-none focus:border-[#1D5F60]"
        />
      )}
    </label>
  )
}
