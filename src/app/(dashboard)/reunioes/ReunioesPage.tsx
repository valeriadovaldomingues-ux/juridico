'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, FileUp, Loader2, NotebookPen, Plus, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TarefaSugerida } from '@/lib/reunioes/extrair-tarefas'

export interface Pessoa { id: string; nome: string }
export interface Reuniao { id: string; titulo: string; data_reuniao: string; participantes: string[]; ata: string; criado_por: string | null; created_at: string }
export interface TarefaDaReuniao { id: string; titulo: string; status: string; responsavel_id: string | null; data: string | null; reuniao_id: string; arquivado: boolean | null }

const STATUS: Record<string, { label: string; cls: string }> = {
  a_fazer: { label: 'A fazer', cls: 'bg-zinc-100 text-zinc-700' },
  fazendo: { label: 'Fazendo', cls: 'bg-sky-50 text-sky-700' },
  com_pendencia: { label: 'Com pendência', cls: 'bg-amber-50 text-amber-700' },
  concluido: { label: 'Concluído', cls: 'bg-emerald-50 text-emerald-700' },
}

const dataBR = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : null)
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export default function ReunioesPage({ reunioes, tarefas, equipe, podeCriar }: { reunioes: Reuniao[]; tarefas: TarefaDaReuniao[]; equipe: Pessoa[]; podeCriar: boolean }) {
  const [aberta, setAberta] = useState<string | null>(null)
  const [nova, setNova] = useState(false)
  const nomes = useMemo(() => new Map(equipe.map(p => [p.id, p.nome])), [equipe])
  const tarefasPor = useMemo(() => {
    const m = new Map<string, TarefaDaReuniao[]>()
    for (const t of tarefas) m.set(t.reuniao_id, [...(m.get(t.reuniao_id) ?? []), t])
    return m
  }, [tarefas])

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 sm:px-7 sm:py-6 shadow-[0_18px_48px_rgba(13,34,53,0.06)]">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-copper)] mb-2">Gestão interna</p>
          <h1 className="font-brand text-[34px] font-semibold text-[var(--color-ink)] tracking-tight leading-none flex items-center gap-2">
            <NotebookPen size={26} className="text-[var(--color-copper)]" /> Reuniões PEDV
          </h1>
          <p className="text-[13px] text-[var(--color-ink-3)] mt-2">Atas das reuniões do escritório. As tarefas de cada pessoa viram cartões no Kanban.</p>
        </div>
        {podeCriar && (
          <button onClick={() => setNova(true)} className="flex items-center gap-2 px-4 py-3 bg-[var(--color-sidebar)] hover:bg-[var(--color-petrol)] text-white text-[13px] font-semibold rounded-xl">
            <Plus size={15} /> Nova reunião
          </button>
        )}
      </div>

      {reunioes.length === 0 ? (
        <p className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-12 text-center text-[13px] text-[var(--color-ink-3)]">
          Nenhuma reunião registrada ainda.{podeCriar && ' Clique em "Nova reunião" e cole ou envie a ata.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {reunioes.map(r => {
            const ts = (tarefasPor.get(r.id) ?? []).filter(t => !t.arquivado)
            const feitas = ts.filter(t => t.status === 'concluido').length
            const expandida = aberta === r.id
            return (
              <li key={r.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                <button onClick={() => setAberta(expandida ? null : r.id)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-[var(--color-surface-warm)]/50">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[var(--color-ink)]">{r.titulo}</p>
                    <p className="text-[12px] text-[var(--color-ink-3)] mt-0.5">
                      {dataBR(r.data_reuniao)}{r.participantes.length > 0 && ` · ${r.participantes.join(', ')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {ts.length > 0 && <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-[var(--color-surface-warm)] text-[var(--color-copper)]">{feitas}/{ts.length} tarefas feitas</span>}
                    <ChevronDown size={16} className={cn('text-[var(--color-ink-3)] transition-transform', expandida && 'rotate-180')} />
                  </div>
                </button>

                {expandida && (
                  <div className="border-t border-[var(--color-border)] px-5 py-4 space-y-5">
                    {ts.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-3)] mb-2">Tarefas no Kanban</p>
                        <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-white">
                          {ts.map(t => {
                            const st = STATUS[t.status] ?? STATUS.a_fazer
                            return (
                              <li key={t.id} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                                <div className="min-w-0">
                                  <p className={cn('text-[13px] leading-snug', t.status === 'concluido' && 'line-through text-[var(--color-ink-3)]')}>{t.titulo}</p>
                                  <p className="text-[11px] text-[var(--color-ink-3)] mt-0.5">
                                    {(t.responsavel_id && nomes.get(t.responsavel_id)) || 'Sem responsável'}{t.data && ` · prazo ${dataBR(t.data)}`}
                                  </p>
                                </div>
                                <span className={cn('shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full', st.cls)}>{st.label}</span>
                              </li>
                            )
                          })}
                        </ul>
                        <Link href="/kanban" className="inline-block mt-2 text-[12px] text-[var(--color-copper)] font-semibold hover:underline">Abrir o Kanban →</Link>
                      </div>
                    )}
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-3)] mb-2">Ata</p>
                      <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-[var(--color-ink-2)] max-h-[420px] overflow-y-auto rounded-xl bg-[var(--color-surface-warm)]/60 p-4">{r.ata}</pre>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {nova && <NovaReuniao equipe={equipe} onFechar={() => setNova(false)} />}
    </div>
  )
}

type Etapa = 'ata' | 'revisar'
interface Linha extends TarefaSugerida { incluir: boolean }

function NovaReuniao({ equipe, onFechar }: { equipe: Pessoa[]; onFechar: () => void }) {
  const router = useRouter()
  const inputArquivo = useRef<HTMLInputElement>(null)
  const [etapa, setEtapa] = useState<Etapa>('ata')
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState(hojeISO())
  const [participantes, setParticipantes] = useState<string[]>([])
  const [ata, setAta] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [ocupado, setOcupado] = useState<'arquivo' | 'ia' | 'salvar' | null>(null)
  const [erro, setErro] = useState('')

  const inputCls = 'w-full px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-[#1D5F60] text-[#1a1d23]'
  const labelCls = 'block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5'

  async function lerArquivo(arquivo: File) {
    setOcupado('arquivo'); setErro('')
    const form = new FormData(); form.append('arquivo', arquivo)
    const res = await fetch('/api/reunioes/ler-arquivo', { method: 'POST', body: form })
    setOcupado(null)
    const corpo = await res.json().catch(() => ({}))
    if (!res.ok) { setErro(corpo.error ?? 'Não foi possível ler o arquivo.'); return }
    setAta(corpo.texto)
    if (!titulo) setTitulo(arquivo.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' '))
  }

  async function extrair() {
    setOcupado('ia'); setErro('')
    const res = await fetch('/api/reunioes/extrair', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ata, data_reuniao: data }),
    })
    setOcupado(null)
    const corpo = await res.json().catch(() => ({}))
    if (!res.ok) { setErro(corpo.error ?? 'Não foi possível extrair as tarefas.'); return }
    setLinhas((corpo.tarefas as TarefaSugerida[]).map(t => ({ ...t, incluir: true })))
    setEtapa('revisar')
  }

  async function salvar() {
    setOcupado('salvar'); setErro('')
    const tarefas = linhas.filter(l => l.incluir && l.titulo.trim()).map(l => ({
      titulo: l.titulo, descricao: l.descricao, prazo: l.prazo, responsavel_id: l.responsavelId,
    }))
    const res = await fetch('/api/reunioes', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ titulo, data_reuniao: data, participantes, ata, tarefas }),
    })
    setOcupado(null)
    const corpo = await res.json().catch(() => ({}))
    if (!res.ok) { setErro(corpo.error ?? 'Não foi possível salvar.'); return }
    if (corpo.aviso) alert(corpo.aviso)
    router.refresh(); onFechar()
  }

  const editar = (i: number, p: Partial<Linha>) => setLinhas(prev => prev.map((l, idx) => idx === i ? { ...l, ...p } : l))
  const qtd = linhas.filter(l => l.incluir && l.titulo.trim()).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f3f4f6] sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-[15px] font-semibold text-[#0f1923]">Nova reunião</h2>
            <p className="text-[11px] text-[#9ca3af]">{etapa === 'ata' ? '1 de 2 · Ata' : '2 de 2 · Conferir as tarefas'}</p>
          </div>
          <button onClick={onFechar} className="p-1.5 rounded-lg text-[#9ca3af] hover:bg-[#f3f4f6]"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {etapa === 'ata' ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-3">
                <div><label className={labelCls}>Título</label><input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Reunião interna — alinhamento de procedimentos" className={inputCls} /></div>
                <div><label className={labelCls}>Data</label><input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} /></div>
              </div>

              <div>
                <label className={labelCls}>Participantes</label>
                <div className="flex flex-wrap gap-2">
                  {equipe.map(p => {
                    const marcado = participantes.includes(p.nome)
                    return (
                      <button key={p.id} type="button" onClick={() => setParticipantes(prev => marcado ? prev.filter(n => n !== p.nome) : [...prev, p.nome])}
                        className={cn('px-2.5 py-1 rounded-full text-[12px] border transition-colors', marcado ? 'bg-[#145A5B] text-white border-[#145A5B]' : 'bg-white text-[#6b7280] border-[#e5e7eb] hover:bg-[#f9fafb]')}>
                        {p.nome}
                      </button>
                    )
                  })}
                </div>
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
                <textarea value={ata} onChange={e => setAta(e.target.value)} rows={13} placeholder="Cole aqui o texto da ata, ou envie o arquivo." className={cn(inputCls, 'leading-relaxed')} />
              </div>
            </>
          ) : (
            <>
              <p className="text-[12px] text-[#6b7280]">
                A IA separou {linhas.length} tarefa{linhas.length !== 1 ? 's' : ''} da ata. <strong>Confira, ajuste e desmarque o que não for tarefa</strong> — só o que estiver marcado vira cartão no Kanban.
              </p>
              {linhas.length === 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">Não encontrei tarefas na ata. Você pode salvar só a ata, ou voltar e conferir o texto.</p>}
              <ul className="space-y-2">
                {linhas.map((l, i) => (
                  <li key={i} className={cn('rounded-xl border p-3 space-y-2', l.incluir ? 'border-[#e5e7eb] bg-white' : 'border-dashed border-[#e5e7eb] bg-[#fafafa] opacity-60')}>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" checked={l.incluir} onChange={e => editar(i, { incluir: e.target.checked })} className="mt-2 rounded border-[#d1d5db]" />
                      <input value={l.titulo} onChange={e => editar(i, { titulo: e.target.value })} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2 pl-6">
                      <div>
                        <select value={l.responsavelId ?? ''} onChange={e => editar(i, { responsavelId: e.target.value || null })} className={cn(inputCls, !l.responsavelId && 'border-amber-300 bg-amber-50')}>
                          <option value="">{l.responsavelTexto ? `Escolher responsável (ata: "${l.responsavelTexto}")` : 'Sem responsável'}</option>
                          {equipe.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                      </div>
                      <input type="date" value={l.prazo ?? ''} onChange={e => editar(i, { prazo: e.target.value || null })} className={inputCls} />
                    </div>
                    {l.descricao && <p className="pl-6 text-[11px] text-[#9ca3af] whitespace-pre-line">{l.descricao}</p>}
                  </li>
                ))}
              </ul>
            </>
          )}

          {erro && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}

          <div className="flex gap-3 pt-1 justify-between">
            {etapa === 'ata' ? (
              <>
                <button onClick={onFechar} className="px-5 py-2.5 text-[13px] font-medium text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb]">Cancelar</button>
                <div className="flex gap-3">
                  <button onClick={() => { setLinhas([]); setEtapa('revisar') }} disabled={!titulo.trim() || !ata.trim()}
                    className="px-4 py-2.5 text-[13px] font-medium text-[#1D5F60] border border-[#1D5F60]/40 rounded-xl hover:bg-[#1D5F60]/5 disabled:opacity-50" title="Salvar só a ata, sem criar tarefas">
                    Só salvar a ata
                  </button>
                  <button onClick={extrair} disabled={!titulo.trim() || ata.trim().length < 30 || ocupado === 'ia'}
                    className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold rounded-xl bg-[#1D5F60] hover:bg-[#27777A] text-white disabled:opacity-50">
                    {ocupado === 'ia' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {ocupado === 'ia' ? 'Lendo a ata…' : 'Extrair tarefas com IA'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <button onClick={() => setEtapa('ata')} className="px-5 py-2.5 text-[13px] font-medium text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb]">Voltar</button>
                <button onClick={salvar} disabled={ocupado === 'salvar'} className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold rounded-xl bg-[#1D5F60] hover:bg-[#27777A] text-white disabled:opacity-50">
                  {ocupado === 'salvar' && <Loader2 size={13} className="animate-spin" />}
                  {qtd > 0 ? `Salvar e criar ${qtd} cartão${qtd !== 1 ? 'ões' : ''} no Kanban` : 'Salvar só a ata'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
