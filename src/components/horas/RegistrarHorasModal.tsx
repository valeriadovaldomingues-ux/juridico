'use client'

import { useState } from 'react'
import { Clock3, Loader2, X } from 'lucide-react'
import SearchableCombobox, { type SearchableComboboxOption } from '@/components/ui/SearchableCombobox'
import { fetchClienteOptions, fetchProcessoOptions } from '@/lib/search/remote'
import type { AgendaTimeEntry } from '@/types'

const hojeBR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

const SUGESTOES = ['Consultoria', 'Reunião com o cliente', 'Elaboração de petição', 'Análise de documentos', 'Pesquisa jurídica', 'Audiência', 'Atendimento por telefone']

const inputCls = 'w-full px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-[#1D5F60] text-[#1a1d23]'
const labelCls = 'block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5'

interface Props {
  /** Dentro de um processo: já vem com o processo e o cliente escolhidos. */
  processo?: { id: string; label: string; clienteNome?: string | null } | null
  /** Só sócio informa valor por hora. */
  podeValor?: boolean
  onClose: () => void
  onSalvo: (entrada: AgendaTimeEntry) => void
}

/** Registrar horas (timesheet). Com processo, ou só com o cliente (consultoria e outros trabalhos sem processo). */
export default function RegistrarHorasModal({ processo = null, podeValor = false, onClose, onSalvo }: Props) {
  const [clienteId, setClienteId] = useState('')
  const [clienteOpcao, setClienteOpcao] = useState<SearchableComboboxOption | null>(null)
  const [processoId, setProcessoId] = useState(processo?.id ?? '')
  const [processoOpcao, setProcessoOpcao] = useState<SearchableComboboxOption | null>(null)
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(hojeBR())
  const [modo, setModo] = useState<'duracao' | 'periodo'>('duracao')
  const [horas, setHoras] = useState('')
  const [minutos, setMinutos] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [cobravel, setCobravel] = useState(true)
  const [valorHora, setValorHora] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    setErro('')
    if (!descricao.trim()) { setErro('Descreva a atividade.'); return }
    if (!processo && !processoId && !clienteId) { setErro('Escolha o cliente (ou um processo).'); return }
    setSalvando(true)
    const res = await fetch('/api/horas/lancar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        descricao, data, modo, horas: Number(horas || 0), minutos: Number(minutos || 0), inicio, fim, cobravel,
        valor_hora: podeValor && valorHora ? valorHora.replace(',', '.') : undefined, observacoes,
        processo_id: processoId || undefined, cliente_id: clienteId || undefined,
      }),
    })
    const j = await res.json().catch(() => ({}))
    setSalvando(false)
    if (!res.ok) { setErro(j.error ?? 'Não foi possível registrar.'); return }
    onSalvo(j as AgendaTimeEntry)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f3f4f6] sticky top-0 bg-white z-10">
          <h2 className="text-[15px] font-semibold text-[#0f1923] flex items-center gap-2"><Clock3 size={15} /> Registrar horas</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#9ca3af] hover:bg-[#f3f4f6]"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {processo ? (
            <div className="rounded-lg bg-[#f0f7f7] px-3 py-2 text-[12px] text-[#1D5F60]">
              Processo: <strong>{processo.label}</strong>{processo.clienteNome ? <> · Cliente: <strong>{processo.clienteNome}</strong></> : null}
            </div>
          ) : (
            <>
              <div>
                <label className={labelCls}>Cliente *</label>
                <SearchableCombobox
                  value={clienteId} selectedOption={clienteOpcao}
                  onChange={(v, o) => { setClienteId(v); setClienteOpcao(o) }}
                  loadOptions={async q => fetchClienteOptions(q, 10)}
                  placeholder="Buscar cliente…" searchPlaceholder="Buscar por nome ou CNPJ/CPF"
                  helperText="Digite ao menos 2 caracteres." emptyText="Digite para buscar clientes." noResultsText="Nenhum resultado encontrado." allowClear
                />
              </div>
              <div>
                <label className={labelCls}>Processo <span className="font-normal normal-case text-[#9ca3af]">(opcional — deixe vazio para consultoria ou outro trabalho sem processo)</span></label>
                <SearchableCombobox
                  value={processoId} selectedOption={processoOpcao}
                  onChange={(v, o) => { setProcessoId(v); setProcessoOpcao(o) }}
                  loadOptions={async q => fetchProcessoOptions(q, 10)}
                  placeholder="— Sem processo —" searchPlaceholder="Buscar processo por número, cliente ou parte"
                  helperText="Digite ao menos 2 caracteres." emptyText="Digite para buscar processos." noResultsText="Nenhum resultado encontrado." allowClear
                />
              </div>
            </>
          )}

          <div>
            <label className={labelCls}>O que foi feito *</label>
            <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: Consultoria sobre contrato de locação" className={inputCls} />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SUGESTOES.map(s => (
                <button key={s} type="button" onClick={() => setDescricao(prev => (prev.trim() ? prev : s))}
                  className="px-2 py-0.5 text-[11px] rounded-full border border-[#e5e7eb] text-[#6b7280] hover:border-[#1D5F60] hover:text-[#1D5F60]">{s}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Data *</label>
              <input type="date" value={data} max={hojeBR()} onChange={e => setData(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Como informar o tempo</label>
              <select value={modo} onChange={e => setModo(e.target.value as 'duracao' | 'periodo')} className={inputCls}>
                <option value="duracao">Quanto tempo levou</option>
                <option value="periodo">Hora de início e de fim</option>
              </select>
            </div>
          </div>

          {modo === 'duracao' ? (
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Horas</label><input type="number" min="0" max="24" value={horas} onChange={e => setHoras(e.target.value)} placeholder="0" className={inputCls} /></div>
              <div><label className={labelCls}>Minutos</label><input type="number" min="0" max="59" value={minutos} onChange={e => setMinutos(e.target.value)} placeholder="30" className={inputCls} /></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Início</label><input type="time" value={inicio} onChange={e => setInicio(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Fim</label><input type="time" value={fim} onChange={e => setFim(e.target.value)} className={inputCls} /></div>
            </div>
          )}

          <label className="flex items-center gap-2 text-[13px] text-[#374151] cursor-pointer">
            <input type="checkbox" checked={cobravel} onChange={e => setCobravel(e.target.checked)} className="rounded border-[#d1d5db]" />
            Hora cobrável (entra no relatório de horas do cliente)
          </label>

          {podeValor && cobravel && (
            <div><label className={labelCls}>Valor por hora (R$) — opcional</label><input value={valorHora} onChange={e => setValorHora(e.target.value)} placeholder="Ex.: 350,00" className={inputCls} /></div>
          )}

          <div>
            <label className={labelCls}>Observações (opcional)</label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>

          {erro && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}

          <div className="flex gap-3 pt-1 justify-end">
            <button onClick={onClose} className="px-5 py-2.5 text-[13px] font-medium text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb]">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold rounded-xl bg-[#1D5F60] hover:bg-[#27777A] text-white disabled:opacity-60">
              {salvando && <Loader2 size={13} className="animate-spin" />} Registrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
