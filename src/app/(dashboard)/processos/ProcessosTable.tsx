'use client'

import Link from 'next/link'
import { useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, ChevronRight, SlidersHorizontal, X } from 'lucide-react'

// ─── Célula de Parte Contrária ────────────────────────────────────────────────

interface ParteItem { id: string; pessoa_nome: string; tipo_parte: string }

function ParteContrariaCell({ partes }: { partes?: ParteItem[] }) {
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (!partes || partes.length === 0) {
    return <span className="text-[#d1d5db] select-none">—</span>
  }

  const [first, ...rest] = partes

  function show() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setOpen(true)
  }
  function hide() {
    timerRef.current = setTimeout(() => setOpen(false), 120)
  }

  return (
    <div
      className="relative inline-flex items-center gap-1.5"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <span className="text-[13px] text-[#3d4a5c] max-w-[150px] truncate leading-tight">
        {first.pessoa_nome}
      </span>

      {rest.length > 0 && (
        <span className="shrink-0 text-[10px] font-semibold text-[#7a8899] bg-[#f3f4f6] px-1.5 py-0.5 rounded-full ring-1 ring-[#e5e7eb]">
          +{rest.length}
        </span>
      )}

      {open && (
        <div
          onMouseEnter={show}
          onMouseLeave={hide}
          className="absolute left-0 top-full mt-2 z-50 bg-white rounded-xl border border-[#e5e7eb] shadow-[0_4px_20px_rgba(0,0,0,0.1)] p-3 min-w-[200px] space-y-2"
        >
          <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2.5">
            Partes contrárias
          </p>
          {partes.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#f3f4f6] flex items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-[#9ca3af]">
                  {p.pessoa_nome.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-[12px] text-[#374151] leading-tight">{p.pessoa_nome}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const areaOptions = [
  { value: '', label: 'Todas as áreas' },
  { value: 'civil', label: 'Cível' },
  { value: 'trabalhista', label: 'Trabalhista' },
  { value: 'criminal', label: 'Criminal' },
  { value: 'tributario', label: 'Tributário' },
  { value: 'previdenciario', label: 'Previdenciário' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'familia', label: 'Família' },
  { value: 'empresarial', label: 'Empresarial' },
  { value: 'outro', label: 'Outro' },
]

const statusOptions = [
  { value: '', label: 'Todos os status' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'suspenso', label: 'Suspenso' },
  { value: 'arquivado', label: 'Arquivado' },
  { value: 'encerrado', label: 'Encerrado' },
]

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  ativo:     { label: 'Ativo',     bg: 'bg-[#e6f4ee]', text: 'text-[#1a7a45]', dot: 'bg-[#2ecc71]' },
  suspenso:  { label: 'Suspenso',  bg: 'bg-[#fef8ec]', text: 'text-[#8a6000]', dot: 'bg-[#f39c12]' },
  arquivado: { label: 'Arquivado', bg: 'bg-[#F3F1EE]', text: 'text-[#7a8899]', dot: 'bg-[#c5cdd8]' },
  encerrado: { label: 'Encerrado', bg: 'bg-[#fde8e8]', text: 'text-[#a93226]', dot: 'bg-[#e74c3c]' },
}

const areaLabels: Record<string, string> = {
  civil: 'Cível', trabalhista: 'Trabalhista', criminal: 'Criminal',
  tributario: 'Tributário', previdenciario: 'Previdenciário',
  administrativo: 'Administrativo', familia: 'Família',
  empresarial: 'Empresarial', outro: 'Outro',
}

export default function ProcessosTable({ processos }: { processos: any[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [titulo, setTitulo] = useState(searchParams.get('titulo') ?? '')
  const [numero, setNumero] = useState(searchParams.get('numero') ?? '')
  const [area, setArea] = useState(searchParams.get('area_direito') ?? '')
  const [status, setStatus] = useState(searchParams.get('status') ?? '')

  function applyFilters() {
    const params = new URLSearchParams()
    if (titulo) params.set('titulo', titulo)
    if (numero) params.set('numero', numero)
    if (area)   params.set('area_direito', area)
    if (status) params.set('status', status)
    router.push(`/processos?${params.toString()}`)
  }

  function clearFilters() {
    setTitulo(''); setNumero(''); setArea(''); setStatus('')
    router.push('/processos')
  }

  const hasFilters = titulo || numero || area || status

  return (
    <div className="bg-white rounded-lg border border-[#E2DDD8] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">

      {/* Filtros */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E2DDD8] flex-wrap">
        <SlidersHorizontal size={14} className="text-[#7a8899] flex-shrink-0" />

        <div className="relative flex-1 min-w-[220px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a8b3c4]" />
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            placeholder="Buscar por título..."
            className="w-full pl-8 pr-3 py-2 text-[13px] bg-[#f5f7fa] border border-transparent rounded-lg outline-none focus:bg-white focus:border-[#E2DDD8] placeholder:text-[#a8b3c4] text-[#0f1923] transition-all"
          />
        </div>

        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          placeholder="Nº processo"
          className="w-44 px-3 py-2 text-[13px] font-mono bg-[#f5f7fa] border border-transparent rounded-lg outline-none focus:bg-white focus:border-[#E2DDD8] placeholder:text-[#a8b3c4] text-[#0f1923] transition-all"
        />

        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="px-3 py-2 text-[13px] bg-[#f5f7fa] border border-transparent rounded-lg outline-none focus:bg-white focus:border-[#E2DDD8] text-[#3d4a5c] transition-all"
        >
          {areaOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 text-[13px] bg-[#f5f7fa] border border-transparent rounded-lg outline-none focus:bg-white focus:border-[#E2DDD8] text-[#3d4a5c] transition-all"
        >
          {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <button
          onClick={applyFilters}
          className="px-4 py-2 bg-[#1D5F60] hover:bg-[#27777A] text-white text-[13px] font-medium rounded-lg transition-colors"
        >
          Filtrar
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

      {/* Tabela */}
      {processos.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-[13px] text-[#7a8899]">Nenhum processo encontrado</p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="bg-[#f9fafb] border-b border-[#E2DDD8]">
              <Th first>Processo</Th>
              <Th>Cliente</Th>
              <Th>Parte Contrária</Th>
              <Th>Área</Th>
              <Th>Tribunal</Th>
              <Th>Status</Th>
              <Th last />
            </tr>
          </thead>
          <tbody>
            {processos.map((processo) => {
              const sc = statusConfig[processo.status]
              return (
                <tr key={processo.id} className="border-b border-[#f5f7fa] last:border-0 hover:bg-[#f9fafb] transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-[13px] font-medium text-[#0f1923] leading-tight">{processo.titulo}</p>
                    {processo.numero_processo && (
                      <p className="text-[11px] text-[#a8b3c4] mt-0.5 font-mono">{processo.numero_processo}</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-[13px] text-[#3d4a5c]">
                    {processo.cliente?.nome ?? '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    <ParteContrariaCell partes={processo.partes_processo} />
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[11px] font-medium text-[#3d4a5c] bg-[#F3F1EE] px-2.5 py-1 rounded-full">
                      {areaLabels[processo.area_direito] ?? processo.area_direito}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-[13px] text-[#3d4a5c]">
                    {processo.tribunal ?? '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    {sc ? (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                    ) : (
                      <span className="text-[13px] text-[#7a8899]">{processo.status}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/processos/${processo.id}`}
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
