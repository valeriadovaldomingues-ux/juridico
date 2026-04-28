'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search, ChevronRight, User, Building2, X,
  Phone, Mail, MessageCircle, Scale, AlertTriangle,
  CheckSquare, Filter, Clock, Tag, Users,
} from 'lucide-react'
import type { Cliente, Profile, TipoContato } from '@/types'
import { cn } from '@/lib/utils'

// ── Constantes ─────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<TipoContato, string> = {
  cliente:         'Cliente',
  parte_contraria: 'Parte Contrária',
  parceiro:        'Parceiro',
  fornecedor:      'Fornecedor',
  comercial:       'Comercial',
}

const TIPO_COLORS: Record<TipoContato, string> = {
  cliente:         'bg-[#e6f4ee] text-[#1a7a45]',
  parte_contraria: 'bg-[#fef3c7] text-[#92400e]',
  parceiro:        'bg-[#ede9fe] text-[#5b21b6]',
  fornecedor:      'bg-[#e0f2fe] text-[#075985]',
  comercial:       'bg-[#fce7f3] text-[#9d174d]',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function diasSemContato(ultimoContato: string | null): number | null {
  if (!ultimoContato) return null
  return Math.floor((Date.now() - new Date(ultimoContato).getTime()) / 86_400_000)
}

function diasLabel(d: number | null): string {
  if (d === null) return '—'
  if (d === 0) return 'Hoje'
  if (d === 1) return '1 dia'
  return `${d}d`
}

function diasColor(d: number | null): string {
  if (d === null) return 'text-[#c5cdd8]'
  if (d <= 7)   return 'text-emerald-600'
  if (d <= 30)  return 'text-amber-600'
  if (d <= 60)  return 'text-orange-600'
  return 'text-red-600'
}

function diasBg(d: number | null): string {
  if (d === null) return ''
  if (d > 60) return 'bg-red-50'
  if (d > 30) return 'bg-amber-50'
  return ''
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()
}

// ── Banner de alertas ──────────────────────────────────────────────────────────

function EsquecidosBanner({
  clientes,
  onFiltrarEsquecidos,
}: {
  clientes: Cliente[]
  onFiltrarEsquecidos: (dias: number) => void
}) {
  const hoje = Date.now()

  const semContato30 = clientes.filter(c => {
    if (!c.ativo) return false
    if (!c.ultimo_contato) {
      const criado = Date.now() - new Date(c.created_at).getTime()
      return criado > 30 * 86_400_000
    }
    const d = Math.floor((hoje - new Date(c.ultimo_contato).getTime()) / 86_400_000)
    return d > 30
  }).length

  const semContato60 = clientes.filter(c => {
    if (!c.ativo) return false
    const ref = c.ultimo_contato ? new Date(c.ultimo_contato).getTime() : new Date(c.created_at).getTime()
    const d = Math.floor((hoje - ref) / 86_400_000)
    return d > 60
  }).length

  if (semContato30 === 0) return null

  return (
    <div className="flex flex-wrap gap-2.5 px-5 py-3 bg-[#fefce8] border-b border-amber-200">
      <div className="flex items-center gap-1.5 text-[12px] text-amber-800">
        <AlertTriangle size={13} className="text-amber-500" />
        <span className="font-semibold">Contatos esquecidos:</span>
      </div>
      {semContato30 > 0 && (
        <button
          onClick={() => onFiltrarEsquecidos(30)}
          className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-amber-700 bg-amber-100 border border-amber-300 rounded-full hover:bg-amber-200 transition-colors"
        >
          <Clock size={10} />
          {semContato30} sem contato há +30 dias
        </button>
      )}
      {semContato60 > 0 && (
        <button
          onClick={() => onFiltrarEsquecidos(60)}
          className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-red-700 bg-red-100 border border-red-300 rounded-full hover:bg-red-200 transition-colors"
        >
          <AlertTriangle size={10} />
          {semContato60} críticos — +60 dias
        </button>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

type FiltroProcesso = '' | 'com' | 'sem'

export default function ClientesTable({
  clientes,
  profiles,
}: {
  clientes: Cliente[]
  profiles: Profile[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // ── Estado dos filtros ─────────────────────────────────────────────────────

  // Server-side (aplicados via URL → page.tsx re-fetcha)
  const [tipo,       setTipo]       = useState(searchParams.get('tipo_contato') ?? '')
  const [responsavel,setResponsavel]= useState(searchParams.get('responsavel_id') ?? '')
  const [apenasAtivos, setApenasAtivos] = useState(searchParams.get('ativo') !== 'false')

  // Client-side (filtram sem reload)
  const [busca,       setBusca]      = useState('')
  const [semContato,  setSemContato] = useState(0)     // dias mínimos sem contato
  const [filtroPro,   setFiltroPro]  = useState<FiltroProcesso>('')

  const [showFilters, setShowFilters] = useState(false)

  // ── Aplica filtros server-side via URL ─────────────────────────────────────

  function applyServerFilters() {
    const params = new URLSearchParams()
    if (tipo)         params.set('tipo_contato', tipo)
    if (responsavel)  params.set('responsavel_id', responsavel)
    if (!apenasAtivos) params.set('ativo', 'false')
    router.push(`/clientes?${params.toString()}`)
  }

  function clearAll() {
    setTipo(''); setResponsavel(''); setApenasAtivos(true)
    setBusca(''); setSemContato(0); setFiltroPro('')
    router.push('/clientes')
  }

  // ── Filtro client-side ─────────────────────────────────────────────────────

  const clientesFiltrados = useMemo(() => {
    const q = normalize(busca)
    const hoje = Date.now()

    return clientes.filter(c => {
      // Busca unificada (nome, email, telefone, cpf)
      if (q) {
        const camposBusca = [c.nome, c.email, c.telefone, c.celular, c.cpf_cnpj, c.empresa]
          .filter(Boolean).map(s => normalize(s!))
        if (!camposBusca.some(s => s.includes(q))) return false
      }

      // Com / Sem processos
      if (filtroPro === 'com' && (c.processos_count ?? 0) === 0) return false
      if (filtroPro === 'sem' && (c.processos_count ?? 0)  > 0) return false

      // Sem contato há X dias
      if (semContato > 0) {
        const ref = c.ultimo_contato
          ? new Date(c.ultimo_contato).getTime()
          : new Date(c.created_at).getTime()
        const d = Math.floor((hoje - ref) / 86_400_000)
        if (d < semContato) return false
      }

      return true
    })
  }, [clientes, busca, filtroPro, semContato])

  // ── Contadores ─────────────────────────────────────────────────────────────
  const totalAtivos = clientes.filter(c => c.ativo).length
  const totalComProcesso = clientes.filter(c => (c.processos_count ?? 0) > 0).length

  const hasServerFilter = tipo || responsavel || !apenasAtivos
  const hasClientFilter = busca || filtroPro || semContato > 0
  const hasAnyFilter    = hasServerFilter || hasClientFilter

  return (
    <div className="bg-white rounded-2xl border border-[#D0DCDC] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">

      {/* ── Alertas de esquecidos ─────────────────────────────────────────── */}
      <EsquecidosBanner
        clientes={clientes}
        onFiltrarEsquecidos={(d) => { setSemContato(d); setShowFilters(true) }}
      />

      {/* ── Barra de busca + filtros ──────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-[#f3f4f6] space-y-3">

        {/* Linha 1: busca + toggle filtros + limpar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c5cdd8] pointer-events-none" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome, e-mail, telefone, CPF/CNPJ…"
              className="w-full pl-9 pr-3 py-2.5 text-[13px] bg-[#f9fafb] border border-transparent rounded-xl outline-none focus:bg-white focus:border-[#D0DCDC] placeholder:text-[#c5cdd8] text-[#0f1923] transition-all"
            />
          </div>

          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-colors border shrink-0',
              showFilters || hasServerFilter
                ? 'bg-[#0F3D3E] text-white border-[#0F3D3E]'
                : 'text-[#7a8899] border-[#e5e7eb] hover:bg-[#f9fafb]',
            )}>
            <Filter size={13} />
            Filtros
            {hasServerFilter && (
              <span className="ml-0.5 text-[10px] bg-white/25 rounded-full px-1.5 py-0.5">
                {[tipo, responsavel, !apenasAtivos ? '1' : ''].filter(Boolean).length}
              </span>
            )}
          </button>

          {hasAnyFilter && (
            <button onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-2.5 text-[12px] text-[#7a8899] hover:text-[#374151] rounded-xl hover:bg-[#f9fafb] border border-[#e5e7eb] transition-colors shrink-0">
              <X size={12} /> Limpar
            </button>
          )}
        </div>

        {/* Linha 2: filtros quick (sempre visíveis) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tipo de contato */}
          {(['', 'cliente', 'parte_contraria', 'parceiro', 'fornecedor', 'comercial'] as ('' | TipoContato)[]).map(t => (
            <button key={t ?? 'all'} onClick={() => setTipo(t)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors border',
                tipo === t
                  ? t === '' ? 'bg-[#0F3D3E] text-white border-[#0F3D3E]' : `${TIPO_COLORS[t as TipoContato]} border-current/30`
                  : 'bg-white text-[#9ca3af] border-[#f3f4f6] hover:border-[#e5e7eb]',
              )}>
              {t === '' ? 'Todos' : TIPO_LABELS[t as TipoContato]}
            </button>
          ))}

          <div className="h-4 w-px bg-[#f3f4f6] mx-1" />

          {/* Com / sem processos */}
          {(['', 'com', 'sem'] as FiltroProcesso[]).map(v => (
            <button key={v} onClick={() => setFiltroPro(v)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors border',
                filtroPro === v
                  ? 'bg-[#0F3D3E] text-white border-[#0F3D3E]'
                  : 'bg-white text-[#9ca3af] border-[#f3f4f6] hover:border-[#e5e7eb]',
              )}>
              {v === '' ? 'Todos' : v === 'com' ? `Com processo (${totalComProcesso})` : `Sem processo`}
            </button>
          ))}

          <div className="h-4 w-px bg-[#f3f4f6] mx-1" />

          {/* Sem contato há X dias */}
          {[0, 30, 60, 90].map(d => (
            <button key={d} onClick={() => setSemContato(d)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors border',
                semContato === d
                  ? d === 0 ? 'bg-[#0F3D3E] text-white border-[#0F3D3E]'
                    : d === 30 ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-red-500 text-white border-red-500'
                  : 'bg-white text-[#9ca3af] border-[#f3f4f6] hover:border-[#e5e7eb]',
              )}>
              {d === 0 ? 'Qualquer período' : `+${d}d sem contato`}
            </button>
          ))}
        </div>

        {/* Linha 3: filtros avançados (colapsável) */}
        {showFilters && (
          <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-[#f9fafb]">
            <div>
              <label className="block text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1">Responsável</label>
              <select value={responsavel} onChange={e => setResponsavel(e.target.value)}
                className="px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B] text-[#374151]">
                <option value="">Todos</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1">Status</label>
              <div className="flex rounded-xl border border-[#e5e7eb] overflow-hidden">
                <button onClick={() => setApenasAtivos(true)}
                  className={cn('px-3 py-2 text-[12px] font-medium transition-colors',
                    apenasAtivos ? 'bg-emerald-600 text-white' : 'bg-white text-[#9ca3af] hover:bg-[#f9fafb]')}>
                  Ativos
                </button>
                <button onClick={() => setApenasAtivos(false)}
                  className={cn('px-3 py-2 text-[12px] font-medium transition-colors border-l border-[#e5e7eb]',
                    !apenasAtivos ? 'bg-slate-600 text-white' : 'bg-white text-[#9ca3af] hover:bg-[#f9fafb]')}>
                  Todos
                </button>
              </div>
            </div>

            <button onClick={applyServerFilters}
              className="self-end px-4 py-2 bg-[#0F3D3E] hover:bg-[#145A5B] text-white text-[13px] font-semibold rounded-xl transition-colors">
              Aplicar
            </button>
          </div>
        )}
      </div>

      {/* ── Cabeçalho da contagem ─────────────────────────────────────────── */}
      <div className="px-5 py-2.5 bg-[#f9fafb] border-b border-[#f3f4f6] flex items-center gap-3 text-[12px] text-[#9ca3af]">
        <Users size={12} />
        <span>
          {clientesFiltrados.length !== clientes.length
            ? `${clientesFiltrados.length} de ${clientes.length} contatos`
            : `${clientes.length} contato${clientes.length !== 1 ? 's' : ''}`}
        </span>
        {totalAtivos < clientes.length && (
          <span className="text-slate-400">· {clientes.length - totalAtivos} inativo{clientes.length - totalAtivos !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* ── Tabela ────────────────────────────────────────────────────────── */}
      {clientesFiltrados.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-[#f3f4f6] rounded-2xl flex items-center justify-center">
            <Users size={20} className="text-[#D0DCDC]" />
          </div>
          <p className="text-[13px] text-[#9ca3af]">Nenhum contato encontrado</p>
          {hasAnyFilter && (
            <button onClick={clearAll} className="text-[12px] text-[#145A5B] hover:underline">
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#f3f4f6]">
              <Th first>Contato</Th>
              <Th>Tipo</Th>
              <Th>Telefone / E-mail</Th>
              <Th>Processos</Th>
              <Th>Responsável</Th>
              <Th>Último contato</Th>
              <Th last>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {clientesFiltrados.map(c => {
              const dias    = diasSemContato(c.ultimo_contato)
              const wa      = (c.celular ?? c.telefone ?? '').replace(/\D/g, '')
              const atrasado = dias !== null && dias > 60
              const aviso    = dias !== null && dias > 30 && dias <= 60

              return (
                <tr key={c.id}
                  className={cn(
                    'border-b border-[#f9fafb] last:border-0 transition-colors group',
                    atrasado ? 'hover:bg-red-50/40' :
                    aviso    ? 'hover:bg-amber-50/40' :
                               'hover:bg-[#fafafa]',
                  )}>

                  {/* Contato — nome + empresa + tags */}
                  <td className="px-5 py-3.5">
                    <Link href={`/clientes/${c.id}`} className="flex items-center gap-3">
                      <div className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                        c.ativo ? 'bg-[#E8F0F0]' : 'bg-[#f3f4f6]',
                      )}>
                        {c.tipo_pessoa === 'juridica'
                          ? <Building2 size={14} className={c.ativo ? 'text-[#145A5B]' : 'text-[#c5cdd8]'} />
                          : <User      size={14} className={c.ativo ? 'text-[#145A5B]' : 'text-[#c5cdd8]'} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={cn(
                            'text-[13px] font-semibold leading-tight',
                            c.ativo ? 'text-[#0f1923]' : 'text-[#9ca3af] line-through',
                          )}>
                            {c.nome}
                          </p>
                          {!c.ativo && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 uppercase tracking-wide">
                              Inativo
                            </span>
                          )}
                        </div>
                        {c.empresa && (
                          <p className="text-[11px] text-[#9ca3af] mt-0.5 truncate">{c.empresa}</p>
                        )}
                        {c.tags && c.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {c.tags.slice(0, 3).map(t => (
                              <span key={t} className="flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded bg-[#f0f7f7] text-[#145A5B]">
                                <Tag size={7} /> {t}
                              </span>
                            ))}
                            {c.tags.length > 3 && (
                              <span className="text-[9px] text-[#9ca3af]">+{c.tags.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                  </td>

                  {/* Tipo */}
                  <td className="px-4 py-3.5">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold',
                      TIPO_COLORS[c.tipo_contato ?? 'cliente'],
                    )}>
                      {TIPO_LABELS[c.tipo_contato ?? 'cliente']}
                    </span>
                  </td>

                  {/* Telefone / E-mail */}
                  <td className="px-4 py-3.5">
                    <div className="space-y-1">
                      {(c.celular ?? c.telefone) && (
                        <div className="flex items-center gap-1.5">
                          {wa ? (
                            <a href={`https://wa.me/55${wa}`} target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1 text-[11px] text-[#374151] hover:text-[#25d366] transition-colors"
                              title="Abrir WhatsApp">
                              <MessageCircle size={11} className="shrink-0" />
                              <span className="font-mono">{c.celular ?? c.telefone}</span>
                            </a>
                          ) : (
                            <span className="flex items-center gap-1 text-[11px] text-[#374151]">
                              <Phone size={11} className="text-[#c5cdd8] shrink-0" />
                              <span className="font-mono">{c.celular ?? c.telefone}</span>
                            </span>
                          )}
                        </div>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 text-[11px] text-[#374151] hover:text-[#145A5B] transition-colors"
                          title={c.email}>
                          <Mail size={11} className="text-[#c5cdd8] shrink-0" />
                          <span className="truncate max-w-[160px]">{c.email}</span>
                        </a>
                      )}
                      {!c.celular && !c.telefone && !c.email && (
                        <span className="text-[11px] text-[#c5cdd8]">—</span>
                      )}
                    </div>
                  </td>

                  {/* Processos */}
                  <td className="px-4 py-3.5">
                    {(c.processos_count ?? 0) > 0 ? (
                      <Link href={`/clientes/${c.id}`}
                        className="flex items-center gap-1.5 text-[12px] font-medium text-[#374151] hover:text-[#145A5B] transition-colors"
                        title="Ver processos">
                        <Scale size={12} className="text-[#9ca3af]" />
                        {c.processos_count}
                      </Link>
                    ) : (
                      <span className="text-[11px] text-[#c5cdd8]">0</span>
                    )}
                  </td>

                  {/* Responsável */}
                  <td className="px-4 py-3.5">
                    {c.responsavel ? (
                      <span className="text-[12px] text-[#374151]">{(c.responsavel as Profile).nome}</span>
                    ) : (
                      <span className="text-[11px] text-[#c5cdd8]">—</span>
                    )}
                  </td>

                  {/* Último contato */}
                  <td className="px-4 py-3.5">
                    <div className={cn(
                      'flex items-center gap-1.5 text-[12px] font-medium',
                      diasColor(dias),
                    )}>
                      {dias !== null && <Clock size={11} className="shrink-0" />}
                      {diasLabel(dias)}
                    </div>
                    {dias !== null && dias > 30 && (
                      <p className="text-[10px] text-[#c5cdd8] mt-0.5">sem interação</p>
                    )}
                  </td>

                  {/* Ações */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {wa && (
                        <a href={`https://wa.me/55${wa}`} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#25d366] hover:bg-[#e8fef2] transition-colors"
                          title="WhatsApp">
                          <MessageCircle size={13} />
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
                          title="Enviar e-mail">
                          <Mail size={13} />
                        </a>
                      )}
                      <Link href={`/clientes/${c.id}?tab=tarefas`}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9ca3af] hover:text-[#145A5B] hover:bg-[#E8F0F0] transition-colors"
                        title="Criar tarefa">
                        <CheckSquare size={13} />
                      </Link>
                      {(c.processos_count ?? 0) > 0 && (
                        <Link href={`/processos?cliente=${c.id}`}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9ca3af] hover:text-[#145A5B] hover:bg-[#E8F0F0] transition-colors"
                          title="Ver processos">
                          <Scale size={13} />
                        </Link>
                      )}
                      <Link href={`/clientes/${c.id}`}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
                        title="Abrir contato">
                        <ChevronRight size={14} />
                      </Link>
                    </div>
                    {/* Seta sempre visível quando sem hover */}
                    <div className="flex items-center gap-1 opacity-100 group-hover:opacity-0 transition-opacity absolute">
                      <Link href={`/clientes/${c.id}`}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#c5cdd8]">
                        <ChevronRight size={14} />
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function Th({ children, first, last }: { children?: React.ReactNode; first?: boolean; last?: boolean }) {
  return (
    <th className={cn(
      'text-left text-[10px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-3 bg-[#f9fafb]',
      first ? 'px-5' : 'px-4',
      last  ? 'w-32' : '',
    )}>
      {children}
    </th>
  )
}
