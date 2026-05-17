'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search, ChevronRight, User, Building2, SlidersHorizontal, X,
  Phone, Mail, MessageCircle, Scale,
} from 'lucide-react'
import type { Cliente, Profile, TipoContato } from '@/types'

const TIPO_LABELS: Record<TipoContato, string> = {
  cliente:        'Cliente',
  parte_contraria:'Parte Contrária',
  parceiro:       'Parceiro',
  fornecedor:     'Fornecedor',
  comercial:      'Comercial',
}

const TIPO_COLORS: Record<TipoContato, string> = {
  cliente:         'bg-[#e6f4ee] text-[#1a7a45]',
  parte_contraria: 'bg-[#fef3c7] text-[#92400e]',
  parceiro:        'bg-[#ede9fe] text-[#5b21b6]',
  fornecedor:      'bg-[#e0f2fe] text-[#075985]',
  comercial:       'bg-[#fce7f3] text-[#9d174d]',
}

function diasSemContato(ultimoContato: string | null): number | null {
  if (!ultimoContato) return null
  const diff = Date.now() - new Date(ultimoContato).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function DiasIndicator({ dias }: { dias: number | null }) {
  if (dias === null) return <span className="text-[12px] text-[#a8b3c4]">—</span>
  const color =
    dias <= 7  ? 'text-[#1a7a45]' :
    dias <= 30 ? 'text-[#d97706]' :
                 'text-[#dc2626]'
  return (
    <span className={`text-[12px] font-medium ${color}`}>
      {dias === 0 ? 'Hoje' : `${dias}d`}
    </span>
  )
}

export default function ClientesTable({
  clientes,
  profiles,
}: {
  clientes: Cliente[]
  profiles: Profile[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [nome, setNome]             = useState(searchParams.get('nome') ?? '')
  const [cpf, setCpf]               = useState(searchParams.get('cpf_cnpj') ?? '')
  const [cidade, setCidade]         = useState(searchParams.get('cidade') ?? '')
  const [tipo, setTipo]             = useState(searchParams.get('tipo_contato') ?? '')
  const [responsavel, setResponsavel] = useState(searchParams.get('responsavel_id') ?? '')
  const [showFilters, setShowFilters] = useState(false)

  function applyFilters() {
    const params = new URLSearchParams()
    if (nome)       params.set('nome', nome)
    if (cpf)        params.set('cpf_cnpj', cpf)
    if (cidade)     params.set('cidade', cidade)
    if (tipo)       params.set('tipo_contato', tipo)
    if (responsavel) params.set('responsavel_id', responsavel)
    router.push(`/clientes?${params.toString()}`)
  }

  function clearFilters() {
    setNome(''); setCpf(''); setCidade(''); setTipo(''); setResponsavel('')
    router.push('/clientes')
  }

  const hasFilters = nome || cpf || cidade || tipo || responsavel

  return (
    <div className="bg-white rounded-lg border border-[#E2DDD8] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">

      {/* Barra de filtros */}
      <div className="px-5 py-4 border-b border-[#E2DDD8]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] transition-all ${
              showFilters || hasFilters
                ? 'bg-[#1D5F60] text-white'
                : 'text-[#7a8899] hover:bg-[#f5f7fa]'
            }`}
          >
            <SlidersHorizontal size={13} />
            Filtros
            {hasFilters && (
              <span className="ml-1 bg-white/30 rounded-full px-1.5 text-[11px]">
                {[nome, cpf, cidade, tipo, responsavel].filter(Boolean).length}
              </span>
            )}
          </button>

          <div className="relative flex-1 max-w-[320px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a8b3c4]" />
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              placeholder="Buscar por nome..."
              className="w-full pl-8 pr-3 py-2 text-[13px] bg-[#f5f7fa] border border-transparent rounded-lg outline-none focus:bg-white focus:border-[#E2DDD8] placeholder:text-[#a8b3c4] text-[#0f1923] transition-all"
            />
          </div>

          <button
            onClick={applyFilters}
            className="px-4 py-2 bg-[#1D5F60] hover:bg-[#27777A] text-white text-[13px] font-medium rounded-lg transition-colors"
          >
            Buscar
          </button>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 text-[13px] text-[#7a8899] hover:text-[#0f1923] rounded-lg hover:bg-[#f5f7fa] transition-all"
            >
              <X size={13} /> Limpar
            </button>
          )}
        </div>

        {showFilters && (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="px-3 py-2 text-[13px] bg-[#f5f7fa] border border-transparent rounded-lg outline-none focus:bg-white focus:border-[#E2DDD8] text-[#0f1923]"
            >
              <option value="">Todos os tipos</option>
              {(Object.entries(TIPO_LABELS) as [TipoContato, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            <select
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              className="px-3 py-2 text-[13px] bg-[#f5f7fa] border border-transparent rounded-lg outline-none focus:bg-white focus:border-[#E2DDD8] text-[#0f1923]"
            >
              <option value="">Todos os responsáveis</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>

            <input
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              placeholder="CPF / CNPJ"
              className="w-40 px-3 py-2 text-[13px] bg-[#f5f7fa] border border-transparent rounded-lg outline-none focus:bg-white focus:border-[#E2DDD8] placeholder:text-[#a8b3c4] text-[#0f1923] transition-all"
            />

            <input
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              placeholder="Cidade"
              className="w-32 px-3 py-2 text-[13px] bg-[#f5f7fa] border border-transparent rounded-lg outline-none focus:bg-white focus:border-[#E2DDD8] placeholder:text-[#a8b3c4] text-[#0f1923] transition-all"
            />
          </div>
        )}
      </div>

      {/* Tabela */}
      {clientes.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-[13px] text-[#7a8899]">Nenhum contato encontrado</p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="bg-[#f9fafb] border-b border-[#E2DDD8]">
              <Th first>Nome</Th>
              <Th>Tipo</Th>
              <Th>Contato</Th>
              <Th>Responsável</Th>
              <Th>Processos</Th>
              <Th>Último contato</Th>
              <Th last />
            </tr>
          </thead>
          <tbody>
            {clientes.map((cliente) => {
              const dias = diasSemContato(cliente.ultimo_contato)
              const whatsapp = (cliente.celular ?? '').replace(/\D/g, '')
              return (
                <tr
                  key={cliente.id}
                  className="border-b border-[#f5f7fa] last:border-0 hover:bg-[#f9fafb] transition-colors"
                >
                  {/* Nome */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#E8F2F2] flex items-center justify-center flex-shrink-0">
                        {cliente.tipo_pessoa === 'juridica'
                          ? <Building2 size={13} className="text-[#1D5F60]" />
                          : <User size={13} className="text-[#1D5F60]" />
                        }
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-[#0f1923] leading-tight">{cliente.nome}</p>
                        {cliente.empresa && (
                          <p className="text-[11px] text-[#a8b3c4] mt-0.5">{cliente.empresa}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Tipo */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${TIPO_COLORS[cliente.tipo_contato ?? 'cliente']}`}>
                      {TIPO_LABELS[cliente.tipo_contato ?? 'cliente']}
                    </span>
                  </td>

                  {/* Contato rápido */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {(cliente.celular || cliente.telefone) && (
                        <a
                          href={`tel:${cliente.celular ?? cliente.telefone}`}
                          title={cliente.celular ?? cliente.telefone ?? ''}
                          onClick={(e) => e.stopPropagation()}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#a8b3c4] hover:text-[#0f1923] hover:bg-[#E8F2F2] transition-all"
                        >
                          <Phone size={13} />
                        </a>
                      )}
                      {whatsapp && (
                        <a
                          href={`https://wa.me/55${whatsapp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`WhatsApp: ${cliente.celular}`}
                          onClick={(e) => e.stopPropagation()}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#a8b3c4] hover:text-[#25d366] hover:bg-[#e8fef2] transition-all"
                        >
                          <MessageCircle size={13} />
                        </a>
                      )}
                      {cliente.email && (
                        <a
                          href={`mailto:${cliente.email}`}
                          title={cliente.email}
                          onClick={(e) => e.stopPropagation()}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#a8b3c4] hover:text-[#0f1923] hover:bg-[#E8F2F2] transition-all"
                        >
                          <Mail size={13} />
                        </a>
                      )}
                      {!cliente.celular && !cliente.telefone && !cliente.email && (
                        <span className="text-[12px] text-[#c5cdd8]">—</span>
                      )}
                    </div>
                  </td>

                  {/* Responsável */}
                  <td className="px-4 py-3">
                    {cliente.responsavel ? (
                      <span className="text-[12px] text-[#3d4a5c]">{(cliente.responsavel as Profile).nome}</span>
                    ) : (
                      <span className="text-[12px] text-[#c5cdd8]">—</span>
                    )}
                  </td>

                  {/* Processos */}
                  <td className="px-4 py-3">
                    {(cliente.processos_count ?? 0) > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <Scale size={12} className="text-[#7a8899]" />
                        <span className="text-[12px] font-medium text-[#3d4a5c]">
                          {cliente.processos_count}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[12px] text-[#c5cdd8]">0</span>
                    )}
                  </td>

                  {/* Último contato */}
                  <td className="px-4 py-3">
                    <DiasIndicator dias={dias} />
                  </td>

                  {/* Ação */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/clientes/${cliente.id}`}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[#c5cdd8] hover:text-[#0f1923] hover:bg-[#E8F2F2] transition-all"
                    >
                      <ChevronRight size={14} />
                    </Link>
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
    <th className={`text-left text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-3 ${first ? 'px-5' : 'px-4'} ${last ? 'w-10' : ''}`}>
      {children}
    </th>
  )
}
