'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Gavel, Plus, X, Loader2, ExternalLink, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import SearchableCombobox from '@/components/ui/SearchableCombobox'
import { fetchProcessoOptions } from '@/lib/search/remote'

export interface LinhaPainel {
  id: string
  categoria: 'inicial' | 'despacho'
  titulo: string
  detalhe: string | null
  processo: string | null
  partes: string | null
  prazo: string | null
  status: string
  pendencia: string | null
  responsavel: string
  origem: 'trello' | 'cadastro'
}

// Painel aberto/recolhido — lembrado neste navegador (conveniência por pessoa).
const CHAVE_ABERTO = 'painel-iniciais-despachos-aberto'
const ouvintes = new Set<() => void>()
function lerAberto() {
  try { return window.localStorage.getItem(CHAVE_ABERTO) !== 'fechado' } catch { return true }
}
function salvarAberto(aberto: boolean) {
  try { window.localStorage.setItem(CHAVE_ABERTO, aberto ? 'aberto' : 'fechado') } catch { /* sem armazenamento: só vale nesta sessão */ }
  ouvintes.forEach(fn => fn())
}
function usePainelAberto(): [boolean, (v: boolean) => void] {
  const aberto = useSyncExternalStore(
    fn => { ouvintes.add(fn); return () => { ouvintes.delete(fn) } },
    lerAberto,
    () => true,
  )
  return [aberto, salvarAberto]
}

const STATUS: Record<string, { label: string; cls: string }> = {
  a_fazer:       { label: 'A fazer',       cls: 'bg-zinc-100 text-zinc-700' },
  fazendo:       { label: 'Fazendo',       cls: 'bg-sky-50 text-sky-700' },
  com_pendencia: { label: 'Com pendência', cls: 'bg-amber-50 text-amber-700' },
  concluido:     { label: 'Concluído',     cls: 'bg-emerald-50 text-emerald-700' },
}

function formatarData(iso: string | null) {
  if (!iso) return null
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export default function IniciaisDespachosPanel({ linhas, perfis }: { linhas: LinhaPainel[]; perfis: { id: string; nome: string }[] }) {
  const [aba, setAba] = useState<'inicial' | 'despacho'>('inicial')
  const [aberto, setAberto] = usePainelAberto()
  const [novo, setNovo] = useState<null | 'inicial' | 'despacho'>(null)

  const doAba = useMemo(() => linhas.filter(l => l.categoria === aba), [linhas, aba])
  const abertas = (cat: string) => linhas.filter(l => l.categoria === cat && l.status !== 'concluido').length

  const grupos = useMemo(() => {
    const mapa = new Map<string, LinhaPainel[]>()
    for (const l of doAba) mapa.set(l.responsavel, [...(mapa.get(l.responsavel) ?? []), l])
    return [...mapa.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [doAba])

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_8px_28px_rgba(13,34,53,0.05)] overflow-hidden">
      <div className="flex items-center justify-between gap-3 flex-wrap px-5 pt-4">
        <div className="flex gap-1">
          {([['inicial', 'Iniciais', FileText], ['despacho', 'Despachos', Gavel]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => { setAba(id); setAberto(true) }}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors',
                aba === id && aberto ? 'border-[var(--color-copper)] text-[var(--color-ink)]' : 'border-transparent text-[var(--color-ink-3)] hover:text-[var(--color-ink)]',
              )}
            >
              <Icon size={14} /> {label}
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-surface-warm)] text-[var(--color-copper)]">{abertas(id)}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {aberto && (
            <>
              <Link href="/kanban" className="flex items-center gap-1.5 text-[12px] text-[var(--color-ink-3)] hover:text-[var(--color-ink)]">
                Ver no Kanban <ExternalLink size={11} />
              </Link>
              <button
                onClick={() => setNovo(aba)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold text-white bg-[var(--color-sidebar)] hover:bg-[var(--color-petrol)] rounded-xl transition-colors"
              >
                <Plus size={13} /> {aba === 'inicial' ? 'Nova inicial' : 'Novo despacho'}
              </button>
            </>
          )}
          <button
            onClick={() => setAberto(!aberto)}
            aria-expanded={aberto}
            title={aberto ? 'Recolher painel' : 'Abrir painel'}
            className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-[var(--color-ink-2)] border border-[var(--color-border)] rounded-xl hover:border-[var(--color-copper)] hover:bg-[var(--color-surface-warm)] transition-colors"
          >
            {aberto ? 'Recolher' : 'Abrir'}
            <ChevronDown size={13} className={cn('transition-transform', aberto && 'rotate-180')} />
          </button>
        </div>
      </div>

      {aberto ? (
      <div className="border-t border-[var(--color-border)] px-5 py-4 space-y-5">
        {grupos.length === 0 && (
          <p className="text-[13px] text-[var(--color-ink-3)] py-6 text-center">
            {aba === 'inicial' ? 'Nenhuma inicial em andamento.' : 'Nenhum despacho cadastrado. Use "Novo despacho" para repassar um processo.'}
          </p>
        )}
        {grupos.map(([pessoa, itens]) => (
          <div key={pessoa}>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-[13px] font-semibold text-[var(--color-ink)]">{pessoa}</h3>
              <span className="text-[11px] text-[var(--color-ink-3)]">{itens.length} {itens.length === 1 ? 'item' : 'itens'}</span>
            </div>
            <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-white">
              {itens.map(l => {
                const st = STATUS[l.status] ?? STATUS.a_fazer
                const prazo = formatarData(l.prazo)
                return (
                  <li key={l.id} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[13px] text-[var(--color-ink)] leading-snug line-clamp-2">{l.titulo}</p>
                      <p className="text-[11px] text-[var(--color-ink-3)] mt-0.5">
                        {[l.processo && `Proc. ${l.processo}`, l.partes, prazo && `Prazo ${prazo}`, l.origem === 'trello' ? 'Trello' : null].filter(Boolean).join(' · ')}
                      </p>
                      {l.pendencia && <p className="text-[11px] text-amber-700 mt-0.5">Pendência: {l.pendencia}</p>}
                    </div>
                    <span className={cn('shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full', st.cls)}>{st.label}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
      ) : (
        <div className="pb-3" />
      )}

      {novo && <NovoItemModal categoria={novo} perfis={perfis} onFechar={() => setNovo(null)} />}
    </section>
  )
}

function NovoItemModal({ categoria, perfis, onFechar }: { categoria: 'inicial' | 'despacho'; perfis: { id: string; nome: string }[]; onFechar: () => void }) {
  const router = useRouter()
  const inicial = categoria === 'inicial'
  const [partes, setPartes] = useState('')            // inicial: "Cliente X Parte contrária"
  const [email, setEmail] = useState('')              // inicial: assunto do e-mail de referência
  const [processoId, setProcessoId] = useState('')    // despacho
  const [processoLabel, setProcessoLabel] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [prazo, setPrazo] = useState('')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const valido = responsavel && (inicial ? partes.trim() : processoId)

  async function salvar() {
    setSalvando(true); setErro('')
    const corpo = inicial
      ? {
          titulo: `INICIAL — ${partes.trim()}`,
          partes_resumidas: partes.trim(),
          descricao: [email.trim() && `E-mail de referência: ${email.trim()}`, obs.trim()].filter(Boolean).join('\n') || null,
        }
      : {
          titulo: `DESPACHAR — ${processoLabel}`,
          processo_id: processoId,
          numero_processo: processoLabel.split(/\s+/)[0] ?? null,
          descricao: obs.trim() || null,
        }
    const res = await fetch('/api/kanban-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...corpo, categoria, responsavel_id: responsavel, prazo: prazo || null, prioridade: 'alta' }),
    })
    if (!res.ok) {
      setErro((await res.json().catch(() => ({}))).error ?? 'Não foi possível salvar.')
      setSalvando(false); return
    }
    router.refresh(); onFechar()
  }

  const inputCls = 'w-full px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-[#1D5F60] text-[#1a1d23] placeholder:text-[#c5cdd8]'
  const labelCls = 'block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f3f4f6]">
          <h2 className="text-[15px] font-semibold text-[#0f1923]">{inicial ? 'Nova inicial' : 'Novo despacho'}</h2>
          <button onClick={onFechar} className="p-1.5 rounded-lg text-[#9ca3af] hover:bg-[#f3f4f6]"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {inicial ? (
            <>
              <div>
                <label className={labelCls}>Cliente X parte contrária</label>
                <input value={partes} onChange={e => setPartes(e.target.value)} placeholder="Ex: Irricom X Hidrocam" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Assunto do e-mail de referência (opcional)</label>
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder='Ex: COBRANÇA - JUDICIAL - HIDROCAM' className={inputCls} />
              </div>
            </>
          ) : (
            <div>
              <label className={labelCls}>Processo a despachar</label>
              <SearchableCombobox
                value={processoId}
                onChange={(v, o) => { setProcessoId(v); setProcessoLabel(o?.label ?? '') }}
                loadOptions={async q => fetchProcessoOptions(q, 10)}
                placeholder="Buscar processo…"
                searchPlaceholder="Número do processo, cliente ou parte"
                helperText="Digite ao menos 2 caracteres."
                emptyText="Digite para buscar processos."
                noResultsText="Nenhum resultado encontrado."
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{inicial ? 'Quem vai fazer' : 'Quem deve despachar'}</label>
              <select value={responsavel} onChange={e => setResponsavel(e.target.value)} className={inputCls}>
                <option value="">Selecione…</option>
                {perfis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Prazo (opcional)</label>
              <input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Observação (opcional)</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} className={inputCls} />
          </div>
          <p className="text-[11px] text-[#9ca3af]">Isso cria um card no Kanban de quem for escolhido. A posição (a fazer, fazendo, pendência, concluído) é atualizada lá e aparece aqui.</p>
          {erro && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={onFechar} className="flex-1 py-2.5 text-[13px] font-medium text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb]">Cancelar</button>
            <button onClick={salvar} disabled={!valido || salvando} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold rounded-xl bg-[#1D5F60] hover:bg-[#27777A] text-white disabled:opacity-50">
              {salvando && <Loader2 size={13} className="animate-spin" />} Criar card
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
