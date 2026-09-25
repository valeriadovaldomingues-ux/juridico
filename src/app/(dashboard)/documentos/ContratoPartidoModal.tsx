'use client'

import { useState } from 'react'
import { X, Loader2, Download, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import SearchableCombobox from '@/components/ui/SearchableCombobox'
import { fetchClienteOptions } from '@/lib/search/remote'

interface Props {
  onFechar: () => void
}

interface ContratanteSelecionado {
  id:   string
  nome: string
}

function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ContratoPartidoModal({ onFechar }: Props) {
  const [contratantes, setContratantes] = useState<ContratanteSelecionado[]>([])
  const [comboValue,   setComboValue]   = useState('')
  const [representante, setRepresentante] = useState('')
  const [dataInicio,    setDataInicio]    = useState(hojeISO())
  const [salariosMinimos, setSalariosMinimos] = useState('')
  const [diaPagamento,    setDiaPagamento]    = useState('10')
  const [percentualExito, setPercentualExito] = useState('10')
  const [anoParcelaExtra, setAnoParcelaExtra] = useState('')

  const [erro, setErro] = useState('')
  const [camposFaltantesPorCliente, setCamposFaltantesPorCliente] = useState<Record<string, string[]> | null>(null)
  const [gerando, setGerando] = useState(false)

  const plural = contratantes.length > 1

  function adicionarContratante(id: string, nome: string) {
    if (!id || contratantes.some(c => c.id === id)) return
    setContratantes(prev => [...prev, { id, nome }])
    setComboValue('')
  }

  function removerContratante(id: string) {
    setContratantes(prev => prev.filter(c => c.id !== id))
  }

  async function gerar() {
    if (contratantes.length === 0 || !salariosMinimos) return
    setGerando(true)
    setErro('')
    setCamposFaltantesPorCliente(null)

    const params = new URLSearchParams({
      cliente_ids: contratantes.map(c => c.id).join(','),
      data_inicio: dataInicio,
      salarios_minimos: salariosMinimos.replace(',', '.'),
      dia_pagamento: diaPagamento || '10',
      percentual_exito: percentualExito || '10',
    })
    if (plural && representante.trim()) params.set('representante', representante.trim())
    if (anoParcelaExtra.trim()) params.set('ano_parcela_extra', anoParcelaExtra.trim())

    const res = await fetch(`/api/documentos/contrato-partido?${params.toString()}`)

    if (res.status === 422) {
      const body = await res.json().catch(() => ({}))
      setCamposFaltantesPorCliente(body.camposFaltantesPorCliente ?? null)
      setErro(body.error ?? 'Faltam dados de qualificação')
      setGerando(false)
      return
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setErro(body.error ?? 'Erro ao gerar documento')
      setGerando(false)
      return
    }

    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    const cd   = res.headers.get('content-disposition') ?? ''
    const nomeArquivo = cd.match(/filename="(.+)"/)?.[1] ?? 'contrato-honorarios.pdf'
    a.href = url; a.download = nomeArquivo
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setGerando(false)
    onFechar()
  }

  const inputCls = 'w-full px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-[#1D5F60] text-[#1a1d23] placeholder:text-[#c5cdd8] transition-all'
  const labelCls = 'block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f3f4f6]">
          <div>
            <h2 className="text-[15px] font-semibold text-[#0f1923]">Gerar Contrato de Honorários</h2>
            <p className="text-[11px] text-[#9ca3af] mt-0.5">Advocacia de Partido</p>
          </div>
          <button onClick={onFechar} className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>Contratante(s) — CNPJ/CPF, na ordem em que devem aparecer</label>
            <SearchableCombobox
              value={comboValue}
              onChange={(value, option) => { if (value && option) adicionarContratante(value, option.label) }}
              loadOptions={async (query) => fetchClienteOptions(query, 10)}
              placeholder="Buscar cliente para adicionar…"
              searchPlaceholder="Buscar por nome, CPF/CNPJ, telefone ou e-mail"
              helperText="Digite ao menos 2 caracteres."
              emptyText="Digite para buscar clientes."
              noResultsText="Nenhum resultado encontrado."
            />
            {contratantes.length > 0 && (
              <ul className="mt-2 space-y-1">
                {contratantes.map((c, i) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#f9fafb] border border-[#e5e7eb] rounded-lg">
                    <span className="text-[12px] text-[#374151]">{i + 1}. {c.nome}</span>
                    <button onClick={() => removerContratante(c.id)} className="p-1 rounded text-[#c5cdd8] hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {plural && (
            <div>
              <label className={labelCls}>Quem representa todos os contratantes (assina &quot;Pelos Contratantes&quot;)</label>
              <input
                value={representante}
                onChange={e => setRepresentante(e.target.value)}
                placeholder="Ex: Fernando Baltazar dos Santos"
                className={inputCls}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Início da vigência</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Valor (em salários mínimos)</label>
              <input
                value={salariosMinimos}
                onChange={e => setSalariosMinimos(e.target.value)}
                placeholder="Ex: 1 ou 1,5"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Dia de pagamento</label>
              <input value={diaPagamento} onChange={e => setDiaPagamento(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>% de êxito sobre condenação</label>
              <input value={percentualExito} onChange={e => setPercentualExito(e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Ano em que começa a parcela extra de dezembro (opcional)</label>
              <input
                value={anoParcelaExtra}
                onChange={e => setAnoParcelaExtra(e.target.value)}
                placeholder="Deixe em branco se já vale no 1º dezembro da vigência"
                className={inputCls}
              />
            </div>
          </div>

          {camposFaltantesPorCliente && (
            <div className="bg-[#fef8ec] border border-[#f5e6b8] rounded-xl p-3 space-y-1">
              <p className="text-[12px] text-[#8a6000] font-medium">Cadastro incompleto — preencha no cadastro do cliente antes de gerar:</p>
              {Object.entries(camposFaltantesPorCliente).map(([nome, campos]) => (
                <p key={nome} className="text-[12px] text-[#8a6000]">{nome}: {campos.join(', ')}</p>
              ))}
            </div>
          )}

          {erro && !camposFaltantesPorCliente && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={onFechar} className="flex-1 py-2.5 text-[13px] font-medium text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors">
              Cancelar
            </button>
            <button
              onClick={gerar}
              disabled={contratantes.length === 0 || !salariosMinimos || (plural && !representante.trim()) || gerando}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-50',
                'bg-[#1D5F60] hover:bg-[#27777A] text-white',
              )}
            >
              {gerando ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {gerando ? 'Gerando…' : 'Gerar PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
