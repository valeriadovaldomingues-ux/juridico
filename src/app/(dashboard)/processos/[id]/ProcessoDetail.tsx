'use client'

import { useMemo, useState, type ComponentType, type Dispatch, type SetStateAction } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Edit, Users, CalendarDays,
  Plus, Trash2, Pencil, X, Check, Loader2,
  ExternalLink,
  FileText, Clock3, Landmark, Paperclip, CalendarRange, ListChecks, MessageSquare, BarChart3,
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import SearchableCombobox, { type SearchableComboboxOption } from '@/components/ui/SearchableCombobox'
import { fetchUsuarioOptions } from '@/lib/search/remote'
import {
  ANDAMENTO_ORIGEM_LABELS,
  ANDAMENTO_ORIGENS,
  ANDAMENTO_TIPO_LABELS,
  ANDAMENTO_TIPOS,
  andamentoTipoPermitidoParaRole,
  buildAndamentosAuroraContext,
  normalizeAndamentoOrigem,
  normalizeAndamentoTipo,
} from '@/lib/processos/andamentos'
import { canViewRelatorio } from '@/lib/relatorios-inteligentes/permissions'
import type { RelatorioClienteDraft } from '@/lib/relatorios-inteligentes'
import type {
  AndamentoOrigem,
  AndamentoTipo,
  ParteProcesso,
  Prazo,
  ProcessoAndamento,
  UserRole,
} from '@/types'
import ProcessoForm from '../ProcessoForm'
import ComunicacoesTab from './ComunicacoesTab'
import RelatoriosTab from './RelatoriosTab'

// ─── Labels e cores ───────────────────────────────────────────────────────────

const areaLabels: Record<string, string> = {
  civil: 'Cível', trabalhista: 'Trabalhista', criminal: 'Criminal',
  tributario: 'Tributário', previdenciario: 'Previdenciário',
  administrativo: 'Administrativo', familia: 'Família', empresarial: 'Empresarial', outro: 'Outro',
}

const statusColors: Record<string, string> = {
  ativo:     'bg-green-100 text-green-700',
  suspenso:  'bg-amber-100 text-amber-700',
  arquivado: 'bg-gray-100 text-gray-600',
  encerrado: 'bg-red-100 text-red-700',
}

const prioridadeColors: Record<string, string> = {
  urgente: 'bg-red-100 text-red-700',
  alta:    'bg-amber-100 text-amber-700',
  media:   'bg-blue-100 text-blue-700',
  baixa:   'bg-gray-100 text-gray-600',
}

const tipoParteLabel: Record<string, string> = {
  autor:    'Autor',
  reu:      'Réu',
  terceiro: 'Terceiro',
  outro:    'Outro',
}

// Badges das partes — cores suaves, leitura clara, aspecto premium
const tipoParteBadge: Record<string, string> = {
  autor:    'bg-sky-50 text-sky-600 ring-1 ring-sky-200/70',
  reu:      'bg-rose-50 text-rose-600 ring-1 ring-rose-200/70',
  terceiro: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/70',
  outro:    'bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200/70',
}

// Ordem de exibição das partes
const TIPO_ORDEM = ['autor', 'reu', 'terceiro', 'outro']

const OFFICIAL_PROCESS_LINKS = [
  { nome: 'PJe', href: 'https://www.pje.jus.br/' },
  { nome: 'eproc', href: 'https://eproc.jus.br/eproc/' },
  { nome: 'ESAJ', href: 'https://esaj.tjsp.jus.br/' },
  { nome: 'Projudi', href: 'https://projudi.tjpr.jus.br/projudi/' },
  { nome: 'DJEN/CNJ', href: 'https://comunica.pje.jus.br/' },
]

// ─── Tipos internos ───────────────────────────────────────────────────────────

type TipoParte = 'autor' | 'reu' | 'terceiro' | 'outro'

interface ParteForm {
  pessoa_nome: string
  tipo_parte: TipoParte
  documento: string
  observacoes: string
}

const FORM_VAZIO: ParteForm = {
  pessoa_nome: '',
  tipo_parte:  'reu',
  documento:   '',
  observacoes: '',
}

interface AgendaItemSimple {
  id: string
  titulo: string
  tipo: string
  status: string
  data_inicio: string
  hora_inicio?: string
  prazo_final?: string
  prioridade: string
}

interface ClienteSimple {
  id: string
  nome: string
  celular?: string | null
  email?: string | null
}

interface DocumentoProcessoSimple {
  id: string
  processo_id: string | null
  cliente_id: string | null
  nome_arquivo: string
  tipo_documento: string
  storage_path: string
  uploaded_by: string | null
  created_at: string
  uploaded_by_profile?: {
    id: string
    nome: string
    email: string | null
    role: string | null
  } | null
}

type TabAtiva = 'dados' | 'andamentos' | 'comunicacoes' | 'relatorios' | 'documentos' | 'prazos' | 'observacoes'

const TAB_OPTIONS: Array<{ id: TabAtiva; label: string; icon: ComponentType<{ size?: number; className?: string }> }> = [
  { id: 'dados', label: 'Dados gerais', icon: ListChecks },
  { id: 'andamentos', label: 'Andamentos', icon: Clock3 },
  { id: 'comunicacoes', label: 'Comunicação', icon: MessageSquare },
  { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'prazos', label: 'Prazos', icon: CalendarRange },
  { id: 'observacoes', label: 'Observações', icon: Paperclip },
]

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function toInputDateTimeValue(iso?: string | null) {
  const date = iso ? new Date(iso) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

function fromInputDateTimeValue(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ProcessoDetail({
  processo,
  partes: partesIniciais,
  prazos,
  agendaItems = [],
  andamentos: andamentosIniciais = [],
  comunicacoes: comunicacoesIniciais = [],
  relatorios: relatoriosIniciais = [],
  documentos = [],
  role,
}: {
  processo: any
  partes: ParteProcesso[]
  prazos: Prazo[]
  agendaItems?: AgendaItemSimple[]
  andamentos?: ProcessoAndamento[]
  comunicacoes?: any[]
  relatorios?: RelatorioClienteDraft[]
  documentos?: DocumentoProcessoSimple[]
  role: UserRole
}) {
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<TabAtiva>('dados')
  const [andamentos, setAndamentos] = useState(andamentosIniciais)
  const [comunicacoes, setComunicacoes] = useState(comunicacoesIniciais)
  const relatorios = relatoriosIniciais ?? []
  const router = useRouter()
  const latestAndamento = andamentos[0] ?? null
  const nextPrazo = prazos[0] ?? null
  const tabCount = {
    dados: 0,
    andamentos: andamentos.length,
    comunicacoes: comunicacoes.length,
    relatorios: canViewRelatorio(role) ? relatorios.length : 0,
    documentos: documentos.length,
    prazos: prazos.length,
    observacoes: processo.observacoes ? 1 : 0,
  }

  const tabsVisiveis = TAB_OPTIONS
    .filter(option => option.id !== 'comunicacoes' || role !== 'estagiario')
    .filter(option => option.id !== 'relatorios' || canViewRelatorio(role))

  if (editing) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditing(false)}
            className="flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#1a1d23] transition-colors"
          >
            <ArrowLeft size={15} /> Voltar
          </button>
          <h1 className="text-xl font-semibold text-[#1a1d23]">Editar Processo</h1>
        </div>
        <ProcessoForm
          processo={processo}
          parteContraria={partesIniciais[0] ?? null}
          allowImportDocumento={['administrativo', 'advogado', 'gerente', 'socio'].includes(role)}
          onSuccess={() => { setEditing(false); router.refresh() }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/processos"
            className="flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#1a1d23] transition-colors"
          >
            <ArrowLeft size={15} /> Processos
          </Link>
          <span className="text-[#d1d5db]">/</span>
          <h1 className="text-xl font-semibold text-[#1a1d23]">{processo.titulo}</h1>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-2 px-4 py-2.5 border border-[#e5e7eb] text-sm font-medium text-[#374151] rounded-xl hover:bg-[#f9fafb] transition-colors"
        >
          <Edit size={14} /> Editar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">

        {/* ── Coluna principal ── */}
        <div className="col-span-2 space-y-4">

          <div className="grid grid-cols-3 gap-3">
            <SummaryCard
              label="Último andamento"
              value={latestAndamento ? latestAndamento.titulo : 'Nenhum andamento'}
              detail={latestAndamento ? `${formatDateTime(latestAndamento.data_andamento)} · ${ANDAMENTO_TIPO_LABELS[latestAndamento.tipo] ?? latestAndamento.tipo}` : 'Registre o primeiro andamento'}
            />
            <SummaryCard
              label="Próximo prazo"
              value={nextPrazo ? nextPrazo.titulo : 'Sem prazo'}
              detail={nextPrazo ? `${formatDate(nextPrazo.data_final)} · ${prioridadeColors[nextPrazo.prioridade] ? nextPrazo.prioridade : '—'}` : 'Sem prazos cadastrados'}
            />
            <SummaryCard
              label="Documentos"
              value={`${documentos.length}`}
              detail={documentos.length ? 'Arquivos vinculados ao processo' : 'Sem documentos vinculados'}
            />
          </div>

          <div className="bg-white rounded-lg border border-[#e5e7eb] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#f3f4f6]">
              <div>
                <p className="text-xs text-[#9ca3af] uppercase tracking-wider">Processo</p>
                <h2 className="text-sm font-semibold text-[#1a1d23] mt-1">Acompanhamento e documentos</h2>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[processo.status] ?? 'bg-gray-100'}`}>
                {processo.status}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1 px-3 py-3 border-b border-[#f3f4f6] bg-[#fafafa]">
              {tabsVisiveis.map(tabOption => {
                const Icon = tabOption.icon
                const active = tab === tabOption.id
                return (
                  <button
                    key={tabOption.id}
                    onClick={() => setTab(tabOption.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors ${
                      active
                        ? 'bg-[#1D5F60] text-white shadow-sm'
                        : 'text-[#374151] hover:bg-white hover:text-[#1D5F60]'
                    }`}
                  >
                    <Icon size={13} />
                    {tabOption.label}
                    {tabCount[tabOption.id] > 0 && (
                      <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/15 text-white' : 'bg-[#E8F2F2] text-[#1D5F60]'}`}>
                        {tabCount[tabOption.id]}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="p-5">
              {tab === 'dados' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-lg border border-[#e5e7eb] p-6">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <Field label="Número do Processo" value={processo.numero_processo} mono />
                      <Field label="Área do Direito"     value={areaLabels[processo.area_direito] ?? processo.area_direito} />
                      <Field label="Tribunal"             value={processo.tribunal} />
                      <Field label="Comarca"              value={processo.comarca} />
                      <Field label="Vara"                 value={processo.vara} />
                      <Field label="Classe processual"    value={processo.classe_processual} />
                      <Field label="Assunto"              value={processo.assunto} />
                      <Field label="Fase"                 value={processo.fase} />
                      <Field label="Distribuição"         value={processo.data_distribuicao ? formatDate(processo.data_distribuicao) : null} />
                      <Field label="Valor da Causa"       value={processo.valor_causa ? formatCurrency(processo.valor_causa) : null} />
                      <Field label="Segredo de justiça"   value={processo.segredo_justica === null || processo.segredo_justica === undefined ? null : (processo.segredo_justica ? 'Sim' : 'Não')} />
                    </div>
                  </div>

                  <PartesSection
                    processoId={processo.id}
                    partesIniciais={partesIniciais}
                    cliente={processo.cliente ?? null}
                    onEditar={() => setEditing(true)}
                  />
                </div>
              )}

              {tab === 'andamentos' && (
                <AndamentosTab
                  processoId={processo.id}
                  role={role}
                  andamentos={andamentos}
                  setAndamentos={setAndamentos}
                />
              )}

              {tab === 'comunicacoes' && role !== 'estagiario' && (
                <ComunicacoesTab
                  processoId={processo.id}
                  processoTitulo={processo.titulo}
                  role={role}
                  comunicacoesIniciais={comunicacoes}
                  onChange={setComunicacoes}
                />
              )}

              {tab === 'relatorios' && canViewRelatorio(role) && (
                <RelatoriosTab
                  processoId={processo.id}
                  processoTitulo={processo.titulo}
                  clienteNome={processo.cliente?.nome ?? processo.titulo}
                  role={role}
                  relatoriosIniciais={relatorios}
                />
              )}

              {tab === 'documentos' && (
                <DocumentosTab documentos={documentos} />
              )}

              {tab === 'prazos' && (
                <PrazosTab prazos={prazos} />
              )}

              {tab === 'observacoes' && (
                <ObservacoesTab observacoes={processo.observacoes} />
              )}
            </div>
          </div>
        </div>

        {/* ── Coluna lateral ── */}
        <div className="space-y-4">
          <AgendaTimeline processoId={processo.id} items={agendaItems} />

          <div className="bg-white rounded-lg border border-[#e5e7eb] p-5">
            <h2 className="text-xs text-[#9ca3af] uppercase tracking-wider mb-3 flex items-center gap-2">
              <ExternalLink size={12} /> Sistemas oficiais
            </h2>
            <div className="flex flex-wrap gap-2">
              {OFFICIAL_PROCESS_LINKS.map(link => (
                <a
                  key={link.nome}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] px-3 py-2 text-[12px] font-medium text-[#1D5F60] hover:border-[#1D5F60] transition-colors"
                >
                  {link.nome} <ExternalLink size={11} />
                </a>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-[#7a8899]">
              Atalhos abrem os sistemas oficiais em nova aba. O sistema nao preenche login, nao captura cookie e nao salva sessao.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Seção de Partes (visual + CRUD inline) ───────────────────────────────────

function PartesSection({
  processoId,
  partesIniciais,
  cliente,
  onEditar,
}: {
  processoId: string
  partesIniciais: ParteProcesso[]
  cliente: ClienteSimple | null
  onEditar: () => void
}) {
  const [partes, setPartes]           = useState<ParteProcesso[]>(partesIniciais)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [form, setForm]               = useState<ParteForm>(FORM_VAZIO)
  const [saving, setSaving]           = useState(false)
  const [erro, setErro]               = useState('')

  const supabase = createClient()

  const partesOrdenadas = [...partes].sort(
    (a, b) => TIPO_ORDEM.indexOf(a.tipo_parte) - TIPO_ORDEM.indexOf(b.tipo_parte)
  )

  // Total de partes incluindo cliente principal
  const totalPartes = (cliente ? 1 : 0) + partes.length

  function abrirAddForm() {
    setEditingId(null)
    setForm(FORM_VAZIO)
    setErro('')
    setShowAddForm(true)
  }

  function abrirEditForm(parte: ParteProcesso) {
    setShowAddForm(false)
    setEditingId(parte.id)
    setForm({
      pessoa_nome: parte.pessoa_nome,
      tipo_parte:  parte.tipo_parte as TipoParte,
      documento:   parte.documento ?? '',
      observacoes: parte.observacoes ?? '',
    })
    setErro('')
  }

  function cancelar() {
    setShowAddForm(false)
    setEditingId(null)
    setForm(FORM_VAZIO)
    setErro('')
  }

  async function salvarNova() {
    if (!form.pessoa_nome.trim()) { setErro('Nome obrigatório'); return }
    setSaving(true); setErro('')
    const { data, error } = await supabase
      .from('partes_processo')
      .insert({
        processo_id: processoId,
        pessoa_nome: form.pessoa_nome.trim(),
        tipo_parte:  form.tipo_parte,
        documento:   form.documento.trim() || null,
        observacoes: form.observacoes.trim() || null,
      })
      .select()
      .single()

    setSaving(false)
    if (error) { setErro(error.message); return }
    setPartes(prev => [...prev, data as ParteProcesso])
    cancelar()
  }

  async function salvarEdicao() {
    if (!form.pessoa_nome.trim()) { setErro('Nome obrigatório'); return }
    if (!editingId) return
    setSaving(true); setErro('')
    const { data, error } = await supabase
      .from('partes_processo')
      .update({
        pessoa_nome: form.pessoa_nome.trim(),
        tipo_parte:  form.tipo_parte,
        documento:   form.documento.trim() || null,
        observacoes: form.observacoes.trim() || null,
      })
      .eq('id', editingId)
      .select()
      .single()

    setSaving(false)
    if (error) { setErro(error.message); return }
    setPartes(prev => prev.map(p => p.id === editingId ? (data as ParteProcesso) : p))
    cancelar()
  }

  async function excluir(id: string, nome: string) {
    if (!confirm(`Remover "${nome}" das partes?`)) return
    const res = await fetch(`/api/partes-processo/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(body.error ?? 'Sem permissão para remover esta parte')
      return
    }
    setPartes(prev => prev.filter(p => p.id !== id))
  }

  const crudAtivo = showAddForm || editingId !== null

  return (
    <div className="bg-white rounded-lg border border-[#e5e7eb] overflow-hidden">

      {/* ── Cabeçalho ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#f3f4f6]">
        <h2 className="text-sm font-semibold text-[#1a1d23] flex items-center gap-2">
          <Users size={14} className="text-[#6b7280]" />
          Partes do Processo
          <span className="text-xs font-normal text-[#9ca3af]">({totalPartes})</span>
        </h2>
        {!crudAtivo && (
          <div className="flex items-center gap-2">
            <button
              onClick={onEditar}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#374151] border border-[#e5e7eb] rounded-lg hover:bg-[#f9fafb] transition-colors"
            >
              <Edit size={11} /> Editar partes
            </button>
            <button
              onClick={abrirAddForm}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1D5F60] bg-[#E8F2F2] hover:bg-[#d0e5e5] rounded-lg transition-colors"
            >
              <Plus size={13} /> Adicionar
            </button>
          </div>
        )}
      </div>

      {/* ── Lista de partes ── */}
      <div>

        {/* ── Grupo: Cliente ── */}
        {cliente && (
          <div>
            <div className="px-6 pt-4 pb-2">
              <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">
                Cliente
              </span>
            </div>
            <div className="flex items-center gap-4 px-6 pb-4">
              <div className="shrink-0 w-8 h-8 rounded-full bg-[#E8F2F2] flex items-center justify-center">
                <span className="text-[12px] font-bold text-[#1D5F60] leading-none select-none">
                  {cliente.nome.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/clientes/${cliente.id}`} className="group inline-flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-[#111827] group-hover:text-[#1D5F60] transition-colors leading-tight">
                    {cliente.nome}
                  </span>
                  <ExternalLink size={11} className="text-[#9ca3af] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
                {(cliente.celular || cliente.email) && (
                  <p className="text-xs text-[#9ca3af] mt-0.5 truncate">
                    {cliente.celular ?? cliente.email}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-[11px] font-medium tracking-wide px-2.5 py-0.5 rounded-full bg-[#E8F2F2] text-[#1D5F60] ring-1 ring-[#c5dede]/60">
                Cliente
              </span>
            </div>
          </div>
        )}

        {/* Divisor entre cliente e partes */}
        <div className="mx-6 border-t border-[#f3f4f6]" />

        {/* ── Grupo: Partes Contrárias ── */}
        <div className="px-6 pt-4 pb-2">
          <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">
            {partesOrdenadas.length === 1 ? 'Parte Contrária' : 'Partes Contrárias'}
          </span>
        </div>

        <div className="divide-y divide-[#f9fafb]">

        {/* Estado vazio */}
        {partesOrdenadas.length === 0 && !showAddForm && (
          <div className="flex flex-col items-center gap-2 px-6 py-6 text-center">
            <div className="w-9 h-9 rounded-full bg-[#f3f4f6] flex items-center justify-center mb-0.5">
              <Users size={15} className="text-[#d1d5db]" />
            </div>
            <p className="text-sm font-medium text-[#6b7280]">Nenhuma parte contrária cadastrada</p>
            <p className="text-xs text-[#9ca3af]">Adicione as partes envolvidas neste processo</p>
            <button
              onClick={abrirAddForm}
              className="mt-1 text-xs font-semibold text-[#1D5F60] hover:underline inline-flex items-center gap-1"
            >
              <Plus size={11} /> Adicionar parte
            </button>
          </div>
        )}

        {partesOrdenadas.map((parte) => {
          if (editingId === parte.id) {
            return (
              <div key={parte.id} className="px-6 py-4 bg-[#f9fafb]">
                <ParteFormUI
                  form={form}
                  onChange={setForm}
                  onSave={salvarEdicao}
                  onCancel={cancelar}
                  saving={saving}
                  erro={erro}
                  titulo="Editar parte"
                />
              </div>
            )
          }

          return (
            <div key={parte.id} className="flex items-center gap-4 px-6 py-4 hover:bg-[#fafafa] group transition-colors">
              {/* Avatar inicial */}
              <div className="shrink-0 w-8 h-8 rounded-full bg-[#f3f4f6] flex items-center justify-center">
                <span className="text-[12px] font-bold text-[#9ca3af] leading-none select-none">
                  {parte.pessoa_nome.charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Dados */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#111827] leading-tight truncate">
                  {parte.pessoa_nome}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {parte.documento && (
                    <span className="text-[11px] text-[#9ca3af] font-mono">{parte.documento}</span>
                  )}
                  {parte.documento && parte.observacoes && (
                    <span className="text-[#e5e7eb]">·</span>
                  )}
                  {parte.observacoes && (
                    <span className="text-[11px] text-[#9ca3af] truncate">{parte.observacoes}</span>
                  )}
                </div>
              </div>

              {/* Badge papel */}
              <span className={`shrink-0 text-[11px] font-medium tracking-wide px-2.5 py-0.5 rounded-full opacity-80 group-hover:opacity-100 transition-opacity ${tipoParteBadge[parte.tipo_parte] ?? 'bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200/70'}`}>
                {tipoParteLabel[parte.tipo_parte] ?? parte.tipo_parte}
              </span>

              {/* Ações inline */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => abrirEditForm(parte)}
                  className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
                  title="Editar"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => excluir(parte.id, parte.pessoa_nome)}
                  className="p-1.5 rounded-lg text-[#9ca3af] hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Remover"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        })}

        {/* Formulário de nova parte */}
        {showAddForm && (
          <div className="px-6 py-4 bg-[#f9fafb]">
            <ParteFormUI
              form={form}
              onChange={setForm}
              onSave={salvarNova}
              onCancel={cancelar}
              saving={saving}
              erro={erro}
              titulo="Nova parte"
            />
          </div>
        )}
        </div>{/* /divide-y partes */}
      </div>{/* /outer */}
    </div>
  )
}

// ─── Formulário reutilizável (add / edit) ─────────────────────────────────────

function ParteFormUI({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
  erro,
  titulo,
}: {
  form: ParteForm
  onChange: (f: ParteForm) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  erro: string
  titulo: string
}) {
  return (
    <div className="space-y-3">
      <p className="text-[12px] font-semibold text-[#374151]">{titulo}</p>

      <div className="grid grid-cols-2 gap-3">
        {/* Nome */}
        <div className="col-span-2">
          <label className="block text-[11px] text-[#9ca3af] uppercase tracking-wider mb-1">
            Nome <span className="text-red-400">*</span>
          </label>
          <input
            autoFocus
            value={form.pessoa_nome}
            onChange={e => onChange({ ...form, pessoa_nome: e.target.value })}
            placeholder="Nome completo da parte"
            className="w-full px-3 py-2 text-[13px] bg-white border border-[#e5e7eb] rounded-lg outline-none focus:border-[#1D5F60] text-[#1a1d23] placeholder:text-[#d1d5db] transition-colors"
          />
        </div>

        {/* Tipo */}
        <div>
          <label className="block text-[11px] text-[#9ca3af] uppercase tracking-wider mb-1">Tipo</label>
          <select
            value={form.tipo_parte}
            onChange={e => onChange({ ...form, tipo_parte: e.target.value as TipoParte })}
            className="w-full px-3 py-2 text-[13px] bg-white border border-[#e5e7eb] rounded-lg outline-none focus:border-[#1D5F60] text-[#374151] transition-colors"
          >
            <option value="reu">Réu</option>
            <option value="autor">Autor</option>
            <option value="terceiro">Terceiro</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        {/* Documento */}
        <div>
          <label className="block text-[11px] text-[#9ca3af] uppercase tracking-wider mb-1">CPF / CNPJ</label>
          <input
            value={form.documento}
            onChange={e => onChange({ ...form, documento: e.target.value })}
            placeholder="Opcional"
            className="w-full px-3 py-2 text-[13px] bg-white border border-[#e5e7eb] rounded-lg outline-none focus:border-[#1D5F60] text-[#1a1d23] placeholder:text-[#d1d5db] font-mono transition-colors"
          />
        </div>

        {/* Observações */}
        <div className="col-span-2">
          <label className="block text-[11px] text-[#9ca3af] uppercase tracking-wider mb-1">Observações</label>
          <input
            value={form.observacoes}
            onChange={e => onChange({ ...form, observacoes: e.target.value })}
            placeholder="Opcional"
            className="w-full px-3 py-2 text-[13px] bg-white border border-[#e5e7eb] rounded-lg outline-none focus:border-[#1D5F60] text-[#1a1d23] placeholder:text-[#d1d5db] transition-colors"
          />
        </div>
      </div>

      {erro && <p className="text-[12px] text-red-500">{erro}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#145A5B] hover:bg-[#1B6E70] text-white text-[12px] font-medium rounded-lg transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Salvar
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-[#6b7280] hover:text-[#1a1d23] rounded-lg hover:bg-[#f3f4f6] transition-colors"
        >
          <X size={13} /> Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Agenda Timeline ──────────────────────────────────────────────────────────

const TIPO_CHIP: Record<string, string> = {
  tarefa:    'bg-slate-100 text-slate-600',
  evento:    'bg-blue-50 text-blue-600',
  prazo:     'bg-orange-50 text-orange-600',
  audiencia: 'bg-rose-50 text-rose-600',
}
const TIPO_LABEL: Record<string, string> = {
  tarefa: 'Tarefa', evento: 'Evento', prazo: 'Prazo', audiencia: 'Audiência',
}

function AgendaTimeline({
  processoId,
  items,
}: {
  processoId: string
  items: AgendaItemSimple[]
}) {
  const pending   = items.filter(i => i.status === 'pendente')
  const concluded = items.filter(i => i.status !== 'pendente')

  return (
    <div className="bg-white rounded-lg border border-[#e5e7eb] p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs text-[#9ca3af] uppercase tracking-wider flex items-center gap-2">
          <CalendarDays size={12} /> Agenda ({items.length})
        </h2>
        <Link
          href={`/agenda?processo=${processoId}`}
          className="text-[11px] font-semibold text-[#1D5F60] hover:underline"
        >
          Ver tudo
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-[#9ca3af]">Nenhum item na agenda</p>
          <Link
            href="/agenda"
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#1D5F60] hover:underline"
          >
            <Plus size={11} /> Adicionar
          </Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          {pending.map(item => {
            const today  = new Date().toISOString().split('T')[0]
            const ref    = item.prazo_final ?? item.data_inicio
            const overdue = item.status === 'pendente' && ref < today
            return (
              <div key={item.id} className={`flex items-start gap-2 p-2 rounded-xl ${overdue ? 'bg-red-50' : 'bg-[#f9fafb]'}`}>
                <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${TIPO_CHIP[item.tipo] ?? 'bg-slate-100 text-slate-600'}`}>
                  {TIPO_LABEL[item.tipo] ?? item.tipo}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[#1a1d23] leading-tight truncate">{item.titulo}</p>
                  <p className={`text-[10px] mt-0.5 ${overdue ? 'text-red-500 font-semibold' : 'text-[#9ca3af]'}`}>
                    {item.data_inicio.split('-').reverse().join('/')}
                    {item.hora_inicio && ` · ${item.hora_inicio.slice(0, 5)}`}
                    {overdue && ' · Vencido'}
                  </p>
                </div>
              </div>
            )
          })}
          {concluded.length > 0 && (
            <p className="text-[11px] text-[#9ca3af] pt-1 text-center">
              +{concluded.length} concluído{concluded.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#1a1d23] leading-tight">{value}</p>
      <p className="mt-1.5 text-[11px] text-[#6b7280] leading-relaxed">{detail}</p>
    </div>
  )
}

interface AndamentoFormState {
  data_andamento: string
  tipo: AndamentoTipo
  titulo: string
  descricao: string
  origem: AndamentoOrigem
  responsavel_id: string
}

const ANDAMENTO_FORM_VAZIO: AndamentoFormState = {
  data_andamento: toInputDateTimeValue(),
  tipo: 'outro',
  titulo: '',
  descricao: '',
  origem: 'manual',
  responsavel_id: '',
}

function AndamentosTab({
  processoId,
  role,
  andamentos,
  setAndamentos,
}: {
  processoId: string
  role: UserRole
  andamentos: ProcessoAndamento[]
  setAndamentos: Dispatch<SetStateAction<ProcessoAndamento[]>>
}) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AndamentoFormState>(ANDAMENTO_FORM_VAZIO)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | AndamentoTipo>('todos')
  const [filtroOrigem, setFiltroOrigem] = useState<'todos' | AndamentoOrigem>('todos')
  const [busca, setBusca] = useState('')
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFim, setPeriodoFim] = useState('')
  const [responsavelOption, setResponsavelOption] = useState<SearchableComboboxOption | null>(null)

  const andamentosOrdenados = useMemo(() => {
    return [...andamentos].sort((a, b) => new Date(b.data_andamento).getTime() - new Date(a.data_andamento).getTime())
  }, [andamentos])

  const andamentosFiltrados = useMemo(() => {
    return andamentosOrdenados.filter(andamento => {
      if (filtroTipo !== 'todos' && andamento.tipo !== filtroTipo) return false
      if (filtroOrigem !== 'todos' && andamento.origem !== filtroOrigem) return false

      if (busca.trim()) {
        const q = busca.trim().toLowerCase()
        const texto = [
          andamento.titulo,
          andamento.descricao ?? '',
          ANDAMENTO_TIPO_LABELS[andamento.tipo] ?? andamento.tipo,
          ANDAMENTO_ORIGEM_LABELS[andamento.origem] ?? andamento.origem,
          andamento.responsavel?.nome ?? '',
          andamento.criado_por_profile?.nome ?? '',
        ].join(' | ').toLowerCase()
        if (!texto.includes(q)) return false
      }

      if (periodoInicio) {
        const inicio = new Date(periodoInicio)
        const andamentoData = new Date(andamento.data_andamento)
        if (!Number.isNaN(inicio.getTime()) && andamentoData < inicio) return false
      }

      if (periodoFim) {
        const fim = new Date(`${periodoFim}T23:59:59.999`)
        const andamentoData = new Date(andamento.data_andamento)
        if (!Number.isNaN(fim.getTime()) && andamentoData > fim) return false
      }

      return true
    })
  }, [andamentosOrdenados, busca, filtroOrigem, filtroTipo, periodoFim, periodoInicio])

  const contextoAurora = useMemo(
    () => buildAndamentosAuroraContext(andamentosFiltrados),
    [andamentosFiltrados],
  )

  const tiposDisponiveis = role === 'estagiario'
    ? (['observacao'] as AndamentoTipo[])
    : ANDAMENTO_TIPOS

  function limparForm() {
    setShowForm(false)
    setEditingId(null)
    setErro('')
    setForm(ANDAMENTO_FORM_VAZIO)
    setResponsavelOption(null)
  }

  function abrirNovo() {
    setEditingId(null)
    setErro('')
    setShowForm(true)
    setForm({
      ...ANDAMENTO_FORM_VAZIO,
      data_andamento: toInputDateTimeValue(),
      tipo: role === 'estagiario' ? 'observacao' : 'outro',
      origem: 'manual',
    })
    setResponsavelOption(null)
  }

  function abrirEdicao(andamento: ProcessoAndamento) {
    setShowForm(true)
    setEditingId(andamento.id)
    setErro('')
    setForm({
      data_andamento: toInputDateTimeValue(andamento.data_andamento),
      tipo: andamento.tipo,
      titulo: andamento.titulo,
      descricao: andamento.descricao ?? '',
      origem: andamento.origem,
      responsavel_id: andamento.responsavel_id ?? '',
    })
    setResponsavelOption(andamento.responsavel
      ? {
          value: andamento.responsavel.id,
          label: andamento.responsavel.nome,
          description: andamento.responsavel.email ?? andamento.responsavel.role ?? null,
          keywords: [andamento.responsavel.nome, andamento.responsavel.email, andamento.responsavel.role].filter(Boolean) as string[],
        }
      : null)
  }

  async function salvarAndamento() {
    if (!form.titulo.trim()) {
      setErro('Informe o título do andamento.')
      return
    }

    if (!andamentoTipoPermitidoParaRole(role, form.tipo)) {
      setErro('Você pode registrar apenas observações internas.')
      return
    }

    const payload = {
      data_andamento: fromInputDateTimeValue(form.data_andamento) ?? new Date().toISOString(),
      tipo: form.tipo,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      origem: normalizeAndamentoOrigem(form.origem),
      responsavel_id: form.responsavel_id.trim() || null,
    }

    setSaving(true)
    setErro('')

    const method = editingId ? 'PATCH' : 'POST'
    const url = editingId
      ? `/api/processos/andamentos/${editingId}`
      : `/api/processos/${processoId}/andamentos`

    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSaving(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setErro(body.error ?? 'Falha ao salvar andamento')
      return
    }

    const saved = await res.json()
    setAndamentos(prev => {
      if (editingId) {
        return prev.map(item => item.id === editingId ? saved : item)
      }
      return [saved, ...prev]
    })
    limparForm()
  }

  async function excluirAndamento(id: string) {
    if (!confirm('Deseja excluir este andamento?')) return
    const res = await fetch(`/api/processos/andamentos/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(body.error ?? 'Falha ao excluir andamento')
      return
    }
    setAndamentos(prev => prev.filter(item => item.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[#9ca3af]">Linha do tempo</p>
          <h3 className="text-sm font-semibold text-[#1a1d23] mt-1">Andamentos do processo</h3>
          <p className="text-[12px] text-[#6b7280] mt-1">
            Registre o histórico cronológico do processo. A Aurora poderá usar esta base como contexto futuro.
          </p>
        </div>
        <button
          onClick={abrirNovo}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#145A5B] text-white text-[12px] font-medium hover:bg-[#1B6E70] transition-colors"
        >
          <Plus size={13} /> Novo andamento
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-[#e5e7eb] bg-[#fafafa] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#9ca3af]">
                {editingId ? 'Editar andamento' : 'Novo andamento'}
              </p>
              <p className="text-[12px] text-[#6b7280] mt-1">
                {role === 'estagiario'
                  ? 'Estagiário pode registrar apenas observações internas.'
                  : 'Preencha os dados e salve para incluir o andamento na linha do tempo.'}
              </p>
            </div>
            <button
              onClick={limparForm}
              className="text-[12px] text-[#6b7280] hover:text-[#1a1d23]"
            >
              Fechar
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#9ca3af] uppercase tracking-wider mb-1">
                Data do andamento
              </label>
              <input
                type="datetime-local"
                value={form.data_andamento}
                onChange={e => setForm(prev => ({ ...prev, data_andamento: e.target.value }))}
                className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#1a1d23] outline-none focus:border-[#1D5F60]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#9ca3af] uppercase tracking-wider mb-1">
                Tipo
              </label>
              <select
                value={form.tipo}
                onChange={e => setForm(prev => ({ ...prev, tipo: normalizeAndamentoTipo(e.target.value) }))}
                className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#1a1d23] outline-none focus:border-[#1D5F60]"
              >
                {tiposDisponiveis.map(tipo => (
                  <option key={tipo} value={tipo}>
                    {ANDAMENTO_TIPO_LABELS[tipo]}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-[11px] text-[#9ca3af] uppercase tracking-wider mb-1">
                Título
              </label>
              <input
                value={form.titulo}
                onChange={e => setForm(prev => ({ ...prev, titulo: e.target.value }))}
                placeholder="Ex.: Decisão publicada"
                className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#1a1d23] outline-none focus:border-[#1D5F60]"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[11px] text-[#9ca3af] uppercase tracking-wider mb-1">
                Descrição
              </label>
              <textarea
                value={form.descricao}
                onChange={e => setForm(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Observações resumidas do andamento"
                rows={4}
                className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#1a1d23] outline-none focus:border-[#1D5F60]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#9ca3af] uppercase tracking-wider mb-1">
                Origem
              </label>
              <select
                value={form.origem}
                onChange={e => setForm(prev => ({ ...prev, origem: normalizeAndamentoOrigem(e.target.value) }))}
                className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#1a1d23] outline-none focus:border-[#1D5F60]"
              >
                {ANDAMENTO_ORIGENS.map(origem => (
                  <option key={origem} value={origem}>
                    {ANDAMENTO_ORIGEM_LABELS[origem]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-[#9ca3af] uppercase tracking-wider mb-1">
                Responsável
              </label>
              <SearchableCombobox
                value={form.responsavel_id}
                onChange={(value, option) => {
                  setForm(prev => ({ ...prev, responsavel_id: value }))
                  setResponsavelOption(option)
                }}
                selectedOption={responsavelOption}
                loadOptions={fetchUsuarioOptions}
                placeholder="Opcional"
                searchPlaceholder="Digite para buscar responsáveis"
                emptyText="Digite para buscar responsáveis."
                minSearchLength={2}
                maxResults={10}
                allowClear
                clearLabel="Remover responsável"
              />
            </div>
          </div>

          {erro && <p className="mt-3 text-[12px] text-red-500">{erro}</p>}

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={salvarAndamento}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#145A5B] px-4 py-2 text-[12px] font-medium text-white hover:bg-[#1B6E70] disabled:opacity-60"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Salvar andamento
            </button>
            <button
              onClick={limparForm}
              className="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] px-4 py-2 text-[12px] font-medium text-[#374151] hover:bg-white"
            >
              <X size={13} />
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className="block text-[11px] text-[#9ca3af] uppercase tracking-wider mb-1">Buscar</label>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Filtrar por título, descrição, responsável..."
            className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#1a1d23] outline-none focus:border-[#1D5F60]"
          />
        </div>
        <div>
          <label className="block text-[11px] text-[#9ca3af] uppercase tracking-wider mb-1">Tipo</label>
          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value as 'todos' | AndamentoTipo)}
            className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#1a1d23] outline-none focus:border-[#1D5F60]"
          >
            <option value="todos">Todos</option>
            {ANDAMENTO_TIPOS.map(tipo => (
              <option key={tipo} value={tipo}>{ANDAMENTO_TIPO_LABELS[tipo]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-[#9ca3af] uppercase tracking-wider mb-1">Origem</label>
          <select
            value={filtroOrigem}
            onChange={e => setFiltroOrigem(e.target.value as 'todos' | AndamentoOrigem)}
            className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#1a1d23] outline-none focus:border-[#1D5F60]"
          >
            <option value="todos">Todas</option>
            {ANDAMENTO_ORIGENS.map(origem => (
              <option key={origem} value={origem}>{ANDAMENTO_ORIGEM_LABELS[origem]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-[#9ca3af] uppercase tracking-wider mb-1">Período inicial</label>
          <input
            type="date"
            value={periodoInicio}
            onChange={e => setPeriodoInicio(e.target.value)}
            className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#1a1d23] outline-none focus:border-[#1D5F60]"
          />
        </div>
        <div>
          <label className="block text-[11px] text-[#9ca3af] uppercase tracking-wider mb-1">Período final</label>
          <input
            type="date"
            value={periodoFim}
            onChange={e => setPeriodoFim(e.target.value)}
            className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#1a1d23] outline-none focus:border-[#1D5F60]"
          />
        </div>
      </div>

      <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#f3f4f6]">
          <p className="text-[12px] font-semibold text-[#1a1d23]">Andamentos</p>
          <span className="text-[11px] text-[#9ca3af]">{andamentosFiltrados.length} registro{andamentosFiltrados.length !== 1 ? 's' : ''}</span>
        </div>

        {andamentosFiltrados.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-[#6b7280]">Nenhum andamento encontrado.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#f3f4f6]">
            {andamentosFiltrados.map(andamento => (
              <div key={andamento.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex rounded-full bg-[#E8F2F2] px-2.5 py-0.5 text-[11px] font-medium text-[#1D5F60]">
                        {ANDAMENTO_TIPO_LABELS[andamento.tipo] ?? andamento.tipo}
                      </span>
                      <span className="inline-flex rounded-full border border-[#e5e7eb] bg-[#fafafa] px-2.5 py-0.5 text-[11px] font-medium text-[#374151]">
                        {ANDAMENTO_ORIGEM_LABELS[andamento.origem] ?? andamento.origem}
                      </span>
                      <span className="text-[11px] text-[#9ca3af]">
                        {formatDateTime(andamento.data_andamento)}
                      </span>
                    </div>
                    <h4 className="mt-2 text-sm font-semibold text-[#1a1d23]">{andamento.titulo}</h4>
                    {andamento.descricao && (
                      <p className="mt-1 text-[12px] leading-relaxed text-[#4b5563] whitespace-pre-line">
                        {andamento.descricao}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[#9ca3af]">
                      <span>Responsável: {andamento.responsavel?.nome ?? '—'}</span>
                      <span>Criado por: {andamento.criado_por_profile?.nome ?? '—'}</span>
                      <span>Criação: {formatDateTime(andamento.created_at)}</span>
                    </div>
                  </div>

                  {role === 'socio' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => abrirEdicao(andamento)}
                        className="rounded-lg p-2 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1d23] transition-colors"
                        title="Editar andamento"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => excluirAndamento(andamento.id)}
                        className="rounded-lg p-2 text-[#6b7280] hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Excluir andamento"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sr-only" aria-hidden="true">
        {buildAndamentosAuroraContext(andamentosFiltrados)}
      </div>
    </div>
  )
}

function DocumentosTab({ documentos }: { documentos: DocumentoProcessoSimple[] }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-[#9ca3af]">Documentos</p>
        <h3 className="text-sm font-semibold text-[#1a1d23] mt-1">Arquivos vinculados ao processo</h3>
        <p className="text-[12px] text-[#6b7280] mt-1">
          Use esta lista para baixar os documentos já vinculados ao processo.
        </p>
      </div>

      {documentos.length === 0 ? (
        <div className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-8 text-center">
          <p className="text-sm text-[#6b7280]">Nenhum documento vinculado a este processo.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
          <div className="divide-y divide-[#f3f4f6]">
            {documentos.map(documento => (
              <div key={documento.id} className="flex items-start justify-between gap-4 px-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#1a1d23] truncate">{documento.nome_arquivo}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[#6b7280]">
                    <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 uppercase tracking-wide">
                      {documento.tipo_documento}
                    </span>
                    <span>{formatDateTime(documento.created_at)}</span>
                    {documento.uploaded_by_profile?.nome && (
                      <span>Enviado por {documento.uploaded_by_profile.nome}</span>
                    )}
                  </div>
                </div>
                <a
                  href={`/api/documentos/${documento.id}/download`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#e5e7eb] px-3 py-2 text-[12px] font-medium text-[#1D5F60] hover:border-[#1D5F60] transition-colors"
                >
                  <Paperclip size={12} /> Baixar
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PrazosTab({ prazos }: { prazos: Prazo[] }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-[#9ca3af]">Prazos</p>
        <h3 className="text-sm font-semibold text-[#1a1d23] mt-1">Prazos e compromissos do processo</h3>
        <p className="text-[12px] text-[#6b7280] mt-1">
          O próximo prazo aparece primeiro; a timeline da agenda continua disponível na lateral.
        </p>
      </div>

      {prazos.length === 0 ? (
        <div className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-8 text-center">
          <p className="text-sm text-[#6b7280]">Nenhum prazo cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {prazos.map((prazo) => (
            <div key={prazo.id} className="rounded-xl border border-[#e5e7eb] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#1a1d23]">{prazo.titulo}</p>
                  {prazo.descricao && (
                    <p className="mt-1 text-[12px] text-[#4b5563] whitespace-pre-line">{prazo.descricao}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[#6b7280]">
                    <span>{formatDate(prazo.data_final)}</span>
                    <span>{prazo.prioridade}</span>
                    <span>{prazo.status}</span>
                    <span>{prazo.tipo}</span>
                  </div>
                </div>
                <span className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full ${prioridadeColors[prazo.prioridade] ?? 'bg-gray-100 text-gray-600'}`}>
                  {prazo.prioridade}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ObservacoesTab({ observacoes }: { observacoes: string | null }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-[#9ca3af]">Observações</p>
        <h3 className="text-sm font-semibold text-[#1a1d23] mt-1">Notas gerais do processo</h3>
        <p className="text-[12px] text-[#6b7280] mt-1">
          Este campo continua editável no formulário principal do processo.
        </p>
      </div>

      <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
        {observacoes ? (
          <p className="text-sm leading-relaxed text-[#374151] whitespace-pre-line">{observacoes}</p>
        ) : (
          <p className="text-sm text-[#6b7280]">Nenhuma observação registrada.</p>
        )}
      </div>
    </div>
  )
}

// ─── Campo de exibição ────────────────────────────────────────────────────────

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-[#9ca3af] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm text-[#374151] ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  )
}
