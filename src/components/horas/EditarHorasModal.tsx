'use client'

import { useState } from 'react'
import { Clock3, Loader2, X } from 'lucide-react'
import SearchableCombobox from '@/components/ui/SearchableCombobox'
import { fetchProcessoOptions, fetchUsuarioOptions } from '@/lib/search/remote'
import type { LinhaHoras } from '@/lib/relatorio-horas/dados'

const inputCls = 'w-full px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-[#1D5F60] text-[#1a1d23]'
const labelCls = 'block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5'

interface Props {
  linha: LinhaHoras
  cliente: string
  onClose: () => void
  onSalvo: () => void
}

/** Edita um lançamento de horas já existente (qualquer um). O cliente não muda; o processo, se trocado, precisa ser do mesmo cliente. */
export default function EditarHorasModal({ linha, cliente, onClose, onSalvo }: Props) {
  const [descricao, setDescricao] = useState(linha.atividade)
  const [data, setData] = useState(linha.dataISO)
  const [modo, setModo] = useState<'duracao' | 'periodo'>(linha.horaInicio && linha.horaFim ? 'periodo' : 'duracao')
  const [horas, setHoras] = useState(String(Math.floor(linha.minutos / 60)))
  const [minutos, setMinutos] = useState(String(linha.minutos % 60))
  const [inicio, setInicio] = useState(linha.horaInicio ?? '')
  const [fim, setFim] = useState(linha.horaFim ?? '')
  const [observacoes, setObservacoes] = useState(linha.observacoes ?? '')
  const [cobravel, setCobravel] = useState(true)
  const [processoId, setProcessoId] = useState(linha.processoId ?? '')
  const [processoOpcao, setProcessoOpcao] = useState(linha.processoId ? { value: linha.processoId, label: linha.processo ?? 'Processo atual' } : null)
  const [responsavelId, setResponsavelId] = useState(linha.responsavelId ?? '')
  const [responsavelOpcao, setResponsavelOpcao] = useState(linha.responsavelId ? { value: linha.responsavelId, label: linha.responsavel } : null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    setErro('')
    if (!descricao.trim()) { setErro('Descreva a atividade.'); return }
    setSalvando(true)
    const res = await fetch(`/api/horas/lancar/${linha.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        descricao, data, modo, horas: Number(horas || 0), minutos: Number(minutos || 0), inicio, fim, cobravel, observacoes,
        processo_id: processoId || null, responsavel_id: responsavelId || undefined,
      }),
    })
    const j = await res.json().catch(() => ({}))
    setSalvando(false)
    if (!res.ok) { setErro(j.error ?? 'Não foi possível salvar.'); return }
    onSalvo()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f3f4f6] sticky top-0 bg-white z-10">
          <h2 className="text-[15px] font-semibold text-[#0f1923] flex items-center gap-2"><Clock3 size={15} /> Editar lançamento de horas</h2>
          <button onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-lg text-[#9ca3af] hover:bg-[#f3f4f6]"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-lg bg-[#f0f7f7] px-3 py-2 text-[12px] text-[#1D5F60]">Cliente: <strong>{cliente}</strong></div>

          <div>
            <label className={labelCls}>O que foi feito *</label>
            <input value={descricao} onChange={e => setDescricao(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Processo <span className="font-normal normal-case text-[#9ca3af]">(opcional — vazio = consultoria / sem processo)</span></label>
            <SearchableCombobox
              value={processoId} selectedOption={processoOpcao}
              onChange={(v, o) => { setProcessoId(v); setProcessoOpcao(o) }}
              loadOptions={async q => fetchProcessoOptions(q, 10)}
              placeholder="— Sem processo —" searchPlaceholder="Buscar processo por número, cliente ou parte"
              helperText="Digite ao menos 2 caracteres." emptyText="Digite para buscar processos." noResultsText="Nenhum resultado encontrado." allowClear
            />
          </div>

          <div>
            <label className={labelCls}>Quem fez</label>
            <SearchableCombobox
              value={responsavelId} selectedOption={responsavelOpcao}
              onChange={(v, o) => { setResponsavelId(v); setResponsavelOpcao(o) }}
              loadOptions={async q => fetchUsuarioOptions(q, 10)}
              placeholder="Buscar pessoa…" searchPlaceholder="Buscar pela equipe"
              helperText="Digite ao menos 2 caracteres." emptyText="Digite para buscar." noResultsText="Nenhum resultado encontrado."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Data *</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} />
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
              <div><label className={labelCls}>Horas</label><input type="number" min="0" max="24" value={horas} onChange={e => setHoras(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Minutos</label><input type="number" min="0" max="59" value={minutos} onChange={e => setMinutos(e.target.value)} className={inputCls} /></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Início</label><input type="time" value={inicio} onChange={e => setInicio(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Fim</label><input type="time" value={fim} onChange={e => setFim(e.target.value)} className={inputCls} /></div>
            </div>
          )}

          <label className="flex items-center gap-2 text-[13px] text-[#374151] cursor-pointer">
            <input type="checkbox" checked={cobravel} onChange={e => setCobravel(e.target.checked)} className="rounded border-[#d1d5db]" />
            Hora cobrável (desmarcar tira este lançamento do relatório do cliente)
          </label>

          <div>
            <label className={labelCls}>Observações (opcional)</label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>

          {erro && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}

          <div className="flex gap-3 pt-1 justify-end">
            <button onClick={onClose} className="px-5 py-2.5 text-[13px] font-medium text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb]">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold rounded-xl bg-[#1D5F60] hover:bg-[#27777A] text-white disabled:opacity-60">
              {salvando && <Loader2 size={13} className="animate-spin" />} Salvar alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
