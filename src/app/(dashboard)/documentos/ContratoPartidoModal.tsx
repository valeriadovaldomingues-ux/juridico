'use client'

import { useState } from 'react'
import { X, Loader2, Download, Trash2, Plus } from 'lucide-react'
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

interface FaixaValorForm {
  mes:   string // "YYYY-MM"
  valor: string // salários mínimos
}

function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function mesAtualYYYYMM() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function ContratoPartidoModal({ onFechar }: Props) {
  const [contratantes, setContratantes] = useState<ContratanteSelecionado[]>([])
  const [comboValue,   setComboValue]   = useState('')
  const [representante, setRepresentante] = useState('')
  const [dataInicio,    setDataInicio]    = useState(hojeISO())
  const [escalonado,      setEscalonado]      = useState(false)
  const [salariosMinimos, setSalariosMinimos] = useState('')
  const [faixasValor,     setFaixasValor]     = useState<FaixaValorForm[]>([{ mes: mesAtualYYYYMM(), valor: '' }])
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

  function adicionarFaixa() {
    setFaixasValor(prev => [...prev, { mes: mesAtualYYYYMM(), valor: '' }])
  }
  function removerFaixa(i: number) {
    setFaixasValor(prev => prev.filter((_, idx) => idx !== i))
  }
  function atualizarFaixa(i: number, campo: keyof FaixaValorForm, valor: string) {
    setFaixasValor(prev => prev.map((f, idx) => idx === i ? { ...f, [campo]: valor } : f))
  }

  const faixasCompletas = faixasValor.every(f => f.mes && f.valor.trim())
  const valorPreenchido = escalonado ? (faixasValor.length > 0 && faixasCompletas) : !!salariosMinimos

  async function gerar() {
    if (contratantes.length === 0 || !valorPreenchido) return
    setGerando(true)
    setErro('')
    setCamposFaltantesPorCliente(null)

    const params = new URLSearchParams({
      cliente_ids: contratantes.map(c => c.id).join(','),
      data_inicio: dataInicio,
      dia_pagamento: diaPagamento || '10',
      percentual_exito: percentualExito || '10',
    })
    if (escalonado) {
      params.set('faixas_valor', JSON.stringify(faixasValor.map(f => ({
        inicio: `${f.mes}-01`,
        salariosMinimos: Number(f.valor.replace(',', '.')),
      }))))
    } else {
      params.set('salarios_minimos', salariosMinimos.replace(',', '.'))
    }
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
              <label className={labelCls}>Dia de pagamento</label>
              <input value={diaPagamento} onChange={e => setDiaPagamento(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Valores escalonados?</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEscalonado(false)}
                className={cn(
                  'flex-1 py-2 text-[13px] font-medium rounded-xl border transition-colors',
                  !escalonado ? 'bg-[#1D5F60] text-white border-[#1D5F60]' : 'bg-white text-[#6b7280] border-[#e5e7eb] hover:bg-[#f9fafb]',
                )}
              >
                Não — valor fixo
              </button>
              <button
                type="button"
                onClick={() => setEscalonado(true)}
                className={cn(
                  'flex-1 py-2 text-[13px] font-medium rounded-xl border transition-colors',
                  escalonado ? 'bg-[#1D5F60] text-white border-[#1D5F60]' : 'bg-white text-[#6b7280] border-[#e5e7eb] hover:bg-[#f9fafb]',
                )}
              >
                Sim — sobe com o tempo
              </button>
            </div>
          </div>

          {!escalonado ? (
            <div>
              <label className={labelCls}>Valor (em salários mínimos)</label>
              <input
                value={salariosMinimos}
                onChange={e => setSalariosMinimos(e.target.value)}
                placeholder="Ex: 1 ou 1,5"
                className={inputCls}
              />
            </div>
          ) : (
            <div>
              <label className={labelCls}>A partir de quando, pra quanto sobe</label>
              <div className="space-y-2">
                {faixasValor.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="month"
                      value={f.mes}
                      onChange={e => atualizarFaixa(i, 'mes', e.target.value)}
                      className={cn(inputCls, 'flex-1')}
                    />
                    <input
                      value={f.valor}
                      onChange={e => atualizarFaixa(i, 'valor', e.target.value)}
                      placeholder="s.m."
                      className={cn(inputCls, 'w-20')}
                    />
                    {faixasValor.length > 1 && (
                      <button onClick={() => removerFaixa(i)} className="p-1.5 rounded-lg text-[#c5cdd8] hover:text-red-600 hover:bg-red-50 transition-colors shrink-0">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={adicionarFaixa}
                className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-[#1D5F60] hover:underline"
              >
                <Plus size={12} /> Adicionar faixa
              </button>
              <p className="text-[11px] text-[#9ca3af] mt-1.5">
                Ex: 1 s.m. a partir de dez/2025, 2 s.m. a partir de jan/2026, 3 s.m. a partir de jan/2027 (se renovado — faixa após o fim da vigência de 1 ano).
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>% de êxito sobre condenação</label>
              <input value={percentualExito} onChange={e => setPercentualExito(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Ano da parcela extra de dezembro (opcional)</label>
              <input
                value={anoParcelaExtra}
                onChange={e => setAnoParcelaExtra(e.target.value)}
                placeholder="Em branco = já vale no 1º dezembro"
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
              disabled={contratantes.length === 0 || !valorPreenchido || (plural && !representante.trim()) || gerando}
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
