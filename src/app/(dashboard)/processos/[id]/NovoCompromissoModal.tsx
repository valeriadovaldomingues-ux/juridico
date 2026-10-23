'use client'

import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Pessoa { id: string; nome: string }

const inputCls = 'w-full px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-[#1D5F60] text-[#1a1d23]'
const labelCls = 'block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5'

export default function NovoCompromissoModal({ processoId, tipo, advogadoId, onFechar, onSalvo }: {
  processoId: string
  tipo: 'prazo' | 'audiencia'
  advogadoId: string | null
  onFechar: () => void
  onSalvo: () => void
}) {
  const ehPrazo = tipo === 'prazo'
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [prioridade, setPrioridade] = useState('media')
  const [responsavelId, setResponsavelId] = useState(advogadoId ?? '')
  const [descricao, setDescricao] = useState('')
  const [equipe, setEquipe] = useState<Pessoa[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    createClient().rpc('perfis_equipe').then(({ data: d }) => setEquipe((d ?? []) as Pessoa[]))
  }, [])

  async function salvar() {
    setSalvando(true); setErro('')
    const res = await fetch(`/api/processos/${processoId}/agenda`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tipo, titulo, data, hora: hora || null, prioridade, responsavel_id: responsavelId || null, descricao }),
    })
    setSalvando(false)
    const corpo = await res.json().catch(() => ({}))
    if (!res.ok) { setErro(corpo.error ?? 'Não foi possível salvar.'); return }
    if (corpo.aviso) alert(corpo.aviso)
    onSalvo()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f3f4f6]">
          <h2 className="text-[15px] font-semibold text-[#0f1923]">{ehPrazo ? 'Novo prazo' : 'Nova audiência'}</h2>
          <button onClick={onFechar} className="p-1.5 rounded-lg text-[#9ca3af] hover:bg-[#f3f4f6]"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>Título *</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} autoFocus className={inputCls}
              placeholder={ehPrazo ? 'Ex: Apresentar contestação' : 'Ex: Audiência de instrução'} />
          </div>
          <div className={ehPrazo ? '' : 'grid grid-cols-2 gap-3'}>
            <div>
              <label className={labelCls}>{ehPrazo ? 'Data final do prazo *' : 'Data *'}</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} />
            </div>
            {!ehPrazo && (
              <div>
                <label className={labelCls}>Horário</label>
                <input type="time" value={hora} onChange={e => setHora(e.target.value)} className={inputCls} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Responsável</label>
              <select value={responsavelId} onChange={e => setResponsavelId(e.target.value)} className={inputCls}>
                <option value="">Advogado do processo</option>
                {equipe.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Prioridade</label>
              <select value={prioridade} onChange={e => setPrioridade(e.target.value)} className={inputCls}>
                <option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Observações</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3} className={inputCls} />
          </div>
          <p className="text-[11px] text-[#9ca3af]">
            Fica ligado a este processo e ao cliente, aparece na Agenda{ehPrazo ? ' e vira um card no Kanban do responsável' : ''}.
          </p>
          {erro && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
          <div className="flex gap-3 justify-between pt-1">
            <button onClick={onFechar} className="px-5 py-2.5 text-[13px] font-medium text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb]">Cancelar</button>
            <button onClick={salvar} disabled={salvando || !titulo.trim() || !data}
              className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold rounded-xl bg-[#1D5F60] hover:bg-[#27777A] text-white disabled:opacity-50">
              {salvando && <Loader2 size={13} className="animate-spin" />} Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
