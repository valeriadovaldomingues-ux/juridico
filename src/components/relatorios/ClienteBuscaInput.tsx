'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, Building2, User, Loader2 } from 'lucide-react'
import type { ClienteBuscaResult } from '@/app/api/clientes/busca/route'

interface Props {
  onSelect:    (cliente: ClienteBuscaResult) => void
  onClear:     () => void
  selected:    ClienteBuscaResult | null
  placeholder?: string
  tipoContato?: string
}

export default function ClienteBuscaInput({
  onSelect, onClear, selected, placeholder = 'Razão social, CNPJ, CPF, sócio…', tipoContato = '',
}: Props) {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<ClienteBuscaResult[]>([])
  const [loading,  setLoading]  = useState(false)
  const [open,     setOpen]     = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Busca com debounce de 300ms
  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ q: query, limit: '12' })
        if (tipoContato) params.set('tipo_contato', tipoContato)
        const res = await fetch(`/api/clientes/busca?${params}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data)
          setOpen(data.length > 0)
        }
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, tipoContato])

  const handleSelect = useCallback((c: ClienteBuscaResult) => {
    onSelect(c)
    setQuery('')
    setResults([])
    setOpen(false)
  }, [onSelect])

  const handleClear = useCallback(() => {
    onClear()
    setQuery('')
    setResults([])
    setOpen(false)
  }, [onClear])

  // ── Estado: cliente selecionado ────────────────────────────────────────────
  if (selected) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-[#f0f7f7] border border-[#145A5B]/25 rounded-xl">
        <div className="w-8 h-8 bg-[#145A5B]/15 rounded-lg flex items-center justify-center shrink-0">
          {selected.tipo_pessoa === 'juridica'
            ? <Building2 size={14} className="text-[#145A5B]" />
            : <User size={14} className="text-[#145A5B]" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#0f1923] truncate">{selected.nome}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {selected.nome_fantasia && (
              <span className="text-[11px] text-[#9ca3af] truncate">{selected.nome_fantasia}</span>
            )}
            {selected.cpf_cnpj && (
              <span className="text-[11px] text-[#145A5B] font-mono">{selected.cpf_cnpj}</span>
            )}
            {selected.cnpj_raiz && (
              <span className="text-[10px] text-[#9ca3af] border border-[#e5e7eb] rounded px-1.5 py-0.5">
                Raiz: {selected.cnpj_raiz}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleClear}
          className="w-7 h-7 flex items-center justify-center text-[#9ca3af] hover:text-[#374151] hover:bg-white/60 rounded-lg transition-colors shrink-0"
          title="Limpar seleção"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  // ── Estado: campo de busca ─────────────────────────────────────────────────
  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" />
        {loading && (
          <Loader2 size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#145A5B] animate-spin pointer-events-none" />
        )}
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-10 py-2.5 text-[13px] bg-white border border-[#e5e7eb] rounded-xl outline-none focus:border-[#145A5B] focus:ring-2 focus:ring-[#145A5B]/10 text-[#374151] placeholder:text-[#c4cdd5] transition-all"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {/* Dropdown de resultados */}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[#e5e7eb] rounded-xl shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto">
          {results.map((c, idx) => (
            <button
              key={c.id}
              onMouseDown={e => { e.preventDefault(); handleSelect(c) }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#f9fafb] transition-colors ${idx > 0 ? 'border-t border-[#f3f4f6]' : ''}`}
            >
              <div className="w-7 h-7 bg-[#f3f4f6] rounded-lg flex items-center justify-center shrink-0">
                {c.tipo_pessoa === 'juridica'
                  ? <Building2 size={12} className="text-[#9ca3af]" />
                  : <User size={12} className="text-[#9ca3af]" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#0f1923] truncate">{c.nome}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {c.nome_fantasia && (
                    <span className="text-[11px] text-[#9ca3af] truncate">{c.nome_fantasia}</span>
                  )}
                  {c.cpf_cnpj && (
                    <span className="text-[11px] text-[#6b7280] font-mono">{c.cpf_cnpj}</span>
                  )}
                  {c.cnpj_raiz && (
                    <span className="text-[10px] text-[#9ca3af] border border-[#e5e7eb] rounded px-1.5 py-0.5 font-mono">
                      raiz {c.cnpj_raiz}
                    </span>
                  )}
                  {c.socio_representante && (
                    <span className="text-[11px] text-[#9ca3af] italic truncate">{c.socio_representante}</span>
                  )}
                </div>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                c.tipo_contato === 'cliente'
                  ? 'bg-[#f0f7f7] text-[#145A5B]'
                  : 'bg-[#f3f4f6] text-[#9ca3af]'
              }`}>
                {TIPO_LABEL[c.tipo_contato] ?? c.tipo_contato}
              </span>
            </button>
          ))}

          {query.length >= 2 && results.length === 0 && !loading && (
            <div className="px-4 py-6 text-center text-[12px] text-[#9ca3af]">
              Nenhum cliente encontrado para "{query}"
            </div>
          )}
        </div>
      )}

      {/* Dica de busca */}
      {query.length > 0 && query.length < 2 && (
        <p className="mt-1.5 text-[11px] text-[#9ca3af] pl-1">Digite ao menos 2 caracteres…</p>
      )}
    </div>
  )
}

const TIPO_LABEL: Record<string, string> = {
  cliente:        'Cliente',
  parte_contraria:'Parte',
  parceiro:       'Parceiro',
  fornecedor:     'Fornecedor',
  comercial:      'Comercial',
}
