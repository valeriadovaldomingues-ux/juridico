'use client'

import { useRef, useState } from 'react'
import { FileUp, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ObrigacaoCliente, TarefaEscritorio } from '@/lib/atas/extrair-ata'

interface Pessoa { id: string; nome: string }
type Etapa = 'ata' | 'revisar'
type LinhaObrigacao = ObrigacaoCliente & { incluir: boolean }
type LinhaTarefa = TarefaEscritorio & { incluir: boolean }

const hojeISO = () => new Date().toISOString().slice(0, 10)

const inputCls = 'w-full px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-[#1D5F60] text-[#1a1d23]'
const labelCls = 'block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5'

export default function AtaAudienciaModal({ processoId, onFechar, onSalvo }: {
  processoId: string
  onFechar: () => void
  onSalvo: () => void
}) {
  const inputArquivo = useRef<HTMLInputElement>(null)
  const [etapa, setEtapa] = useState<Etapa>('ata')
  const [data, setData] = useState(hojeISO())
  const [texto, setTexto] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [resumo, setResumo] = useState('')
  const [obrigacoes, setObrigacoes] = useState<LinhaObrigacao[]>([])
  const [tarefas, setTarefas] = useState<LinhaTarefa[]>([])
  const [equipe, setEquipe] = useState<Pessoa[]>([])
  const [ocupado, setOcupado] = useState<'arquivo' | 'ia' | 'salvar' | null>(null)
  const [erro, setErro] = useState('')

  async function lerArquivo(f: File) {
    setOcupado('arquivo'); setErro('')
    const form = new FormData(); form.append('arquivo', f)
    const res = await fetch('/api/reunioes/ler-arquivo', { method: 'POST', body: form })
    setOcupado(null)
    const corpo = await res.json().catch(() => ({}))
    if (!res.ok) { setErro(corpo.error ?? 'Não foi possível ler o arquivo.'); return }
    setTexto(corpo.texto); setArquivo(f)
  }

  async function extrair() {
    setOcupado('ia'); setErro('')
    const res = await fetch(`/api/processos/${processoId}/atas/extrair`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texto, data_audiencia: data }),
    })
    setOcupado(null)
    const corpo = await res.json().catch(() => ({}))
    if (!res.ok) { setErro(corpo.error ?? 'Não foi possível ler a ata.'); return }
    setResumo(corpo.resumo ?? '')
    setObrigacoes((corpo.obrigacoesCliente as ObrigacaoCliente[]).map(o => ({ ...o, incluir: true })))
    setTarefas((corpo.tarefasEscritorio as TarefaEscritorio[]).map(t => ({ ...t, incluir: true })))
    setEquipe(corpo.equipe ?? [])
    setEtapa('revisar')
  }

  async function salvar() {
    setOcupado('salvar'); setErro('')
    const dados = {
      data_audiencia: data, texto, resumo,
      obrigacoes_cliente: obrigacoes.filter(o => o.incluir && o.titulo.trim()),
      tarefas_escritorio: tarefas.filter(t => t.incluir && t.titulo.trim()).map(t => ({
        titulo: t.titulo, descricao: t.descricao, prazo: t.prazo, responsavel_id: t.responsavelId,
      })),
    }
    const form = new FormData()
    form.append('dados', JSON.stringify(dados))
    if (arquivo) form.append('arquivo', arquivo)
    const res = await fetch(`/api/processos/${processoId}/atas`, { method: 'POST', body: form })
    setOcupado(null)
    const corpo = await res.json().catch(() => ({}))
    if (!res.ok) { setErro(corpo.error ?? 'Não foi possível salvar a ata.'); return }
    const avisos: string[] = [...(corpo.avisos ?? [])]
    if (corpo.sem_data > 0) avisos.push(`${corpo.sem_data} obrigação(ões) do cliente sem data certa ficaram só no andamento (não entram na Agenda).`)
    if (avisos.length) alert(avisos.join('\n'))
    onSalvo()
  }

  const editarOb = (i: number, p: Partial<LinhaObrigacao>) => setObrigacoes(prev => prev.map((l, idx) => idx === i ? { ...l, ...p } : l))
  const editarTa = (i: number, p: Partial<LinhaTarefa>) => setTarefas(prev => prev.map((l, idx) => idx === i ? { ...l, ...p } : l))
  const qtdOb = obrigacoes.filter(o => o.incluir && o.titulo.trim()).length
  const qtdTa = tarefas.filter(t => t.incluir && t.titulo.trim()).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f3f4f6] sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-[15px] font-semibold text-[#0f1923]">Ata de audiência</h2>
            <p className="text-[11px] text-[#9ca3af]">{etapa === 'ata' ? '1 de 2 · Ata' : '2 de 2 · Conferir o que saiu da ata'}</p>
          </div>
          <button onClick={onFechar} className="p-1.5 rounded-lg text-[#9ca3af] hover:bg-[#f3f4f6]"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {etapa === 'ata' ? (
            <>
              <div className="max-w-[200px]">
                <label className={labelCls}>Data da audiência</label>
                <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">Ata</label>
                  <button type="button" onClick={() => inputArquivo.current?.click()} disabled={ocupado === 'arquivo'} className="flex items-center gap-1.5 text-[12px] font-semibold text-[#1D5F60] hover:underline disabled:opacity-60">
                    {ocupado === 'arquivo' ? <Loader2 size={12} className="animate-spin" /> : <FileUp size={12} />} Enviar arquivo (.docx, .pdf ou .txt)
                  </button>
                  <input ref={inputArquivo} type="file" accept=".docx,.doc,.pdf,.txt" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) lerArquivo(f); e.target.value = '' }} />
                </div>
                {arquivo && <p className="mb-1.5 text-[11px] text-[#1D5F60]">Arquivo original guardado junto com a ata: <strong>{arquivo.name}</strong></p>}
                <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={14} placeholder="Cole aqui o texto da ata, ou envie o arquivo." className={cn(inputCls, 'leading-relaxed')} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className={labelCls}>Resumo (aparece no andamento e no e-mail ao cliente)</label>
                <textarea value={resumo} onChange={e => setResumo(e.target.value)} rows={3} className={inputCls} />
              </div>

              <section className="space-y-2">
                <h3 className="text-[13px] font-semibold text-[#0f1923]">O que o cliente precisa fazer <span className="text-[#9ca3af] font-normal">({qtdOb})</span></h3>
                <p className="text-[11px] text-[#9ca3af]">Quem tem data vai para a Agenda do advogado do processo. Tudo isso entra no e-mail ao cliente.</p>
                {obrigacoes.length === 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">Não encontrei obrigações do cliente na ata.</p>}
                <ul className="space-y-2">
                  {obrigacoes.map((o, i) => (
                    <li key={i} className={cn('rounded-xl border p-3 space-y-2', o.incluir ? 'border-[#e5e7eb] bg-white' : 'border-dashed border-[#e5e7eb] bg-[#fafafa] opacity-60')}>
                      <div className="flex items-start gap-2">
                        <input type="checkbox" checked={o.incluir} onChange={e => editarOb(i, { incluir: e.target.checked })} className="mt-2 rounded border-[#d1d5db]" />
                        <input value={o.titulo} onChange={e => editarOb(i, { titulo: e.target.value })} className={inputCls} />
                        <button type="button" onClick={() => setObrigacoes(prev => prev.filter((_, idx) => idx !== i))} className="mt-1.5 p-1 text-[#9ca3af] hover:text-red-600" title="Remover"><Trash2 size={14} /></button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_1fr] gap-2 pl-6">
                        <input type="date" value={o.data ?? ''} onChange={e => editarOb(i, { data: e.target.value || null })} className={cn(inputCls, !o.data && 'border-amber-300 bg-amber-50')} />
                        <input value={o.valor ?? ''} onChange={e => editarOb(i, { valor: e.target.value || null })} placeholder="Valor (se houver)" className={inputCls} />
                        <input value={o.dataTexto ?? ''} onChange={e => editarOb(i, { dataTexto: e.target.value || null })} placeholder="Prazo como na ata" className={inputCls} />
                      </div>
                      {!o.data && <p className="pl-6 text-[11px] text-amber-700">Sem data certa: não entra na Agenda (fica no andamento e no e-mail).</p>}
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => setObrigacoes(prev => [...prev, { titulo: '', descricao: null, data: null, dataTexto: null, valor: null, incluir: true }])}
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-[#1D5F60] hover:underline"><Plus size={12} /> Adicionar obrigação do cliente</button>
              </section>

              <section className="space-y-2">
                <h3 className="text-[13px] font-semibold text-[#0f1923]">O que o escritório precisa fazer <span className="text-[#9ca3af] font-normal">({qtdTa})</span></h3>
                <p className="text-[11px] text-[#9ca3af]">Viram item na Agenda e card no Kanban. Sem responsável escolhido, vai para o advogado do processo.</p>
                {tarefas.length === 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">Não encontrei providências do escritório na ata.</p>}
                <ul className="space-y-2">
                  {tarefas.map((t, i) => (
                    <li key={i} className={cn('rounded-xl border p-3 space-y-2', t.incluir ? 'border-[#e5e7eb] bg-white' : 'border-dashed border-[#e5e7eb] bg-[#fafafa] opacity-60')}>
                      <div className="flex items-start gap-2">
                        <input type="checkbox" checked={t.incluir} onChange={e => editarTa(i, { incluir: e.target.checked })} className="mt-2 rounded border-[#d1d5db]" />
                        <input value={t.titulo} onChange={e => editarTa(i, { titulo: e.target.value })} className={inputCls} />
                        <button type="button" onClick={() => setTarefas(prev => prev.filter((_, idx) => idx !== i))} className="mt-1.5 p-1 text-[#9ca3af] hover:text-red-600" title="Remover"><Trash2 size={14} /></button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2 pl-6">
                        <select value={t.responsavelId ?? ''} onChange={e => editarTa(i, { responsavelId: e.target.value || null })} className={inputCls}>
                          <option value="">{t.responsavelTexto ? `Advogado do processo (ata: "${t.responsavelTexto}")` : 'Advogado do processo'}</option>
                          {equipe.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                        <input type="date" value={t.prazo ?? ''} onChange={e => editarTa(i, { prazo: e.target.value || null })} className={inputCls} />
                      </div>
                      {t.descricao && <p className="pl-6 text-[11px] text-[#9ca3af] whitespace-pre-line">{t.descricao}</p>}
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => setTarefas(prev => [...prev, { titulo: '', descricao: null, prazo: null, responsavelId: null, responsavelTexto: null, incluir: true }])}
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-[#1D5F60] hover:underline"><Plus size={12} /> Adicionar providência do escritório</button>
              </section>
            </>
          )}

          {erro && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}

          <div className="flex gap-3 pt-1 justify-between">
            {etapa === 'ata' ? (
              <>
                <button onClick={onFechar} className="px-5 py-2.5 text-[13px] font-medium text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb]">Cancelar</button>
                <button onClick={extrair} disabled={texto.trim().length < 30 || ocupado === 'ia'}
                  className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold rounded-xl bg-[#1D5F60] hover:bg-[#27777A] text-white disabled:opacity-50">
                  {ocupado === 'ia' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {ocupado === 'ia' ? 'Lendo a ata…' : 'Ler a ata com IA'}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEtapa('ata')} className="px-5 py-2.5 text-[13px] font-medium text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb]">Voltar</button>
                <button onClick={salvar} disabled={ocupado === 'salvar'} className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold rounded-xl bg-[#1D5F60] hover:bg-[#27777A] text-white disabled:opacity-50">
                  {ocupado === 'salvar' && <Loader2 size={13} className="animate-spin" />}
                  Registrar ata e lançar na Agenda
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
