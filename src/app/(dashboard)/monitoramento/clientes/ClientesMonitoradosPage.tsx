'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, CheckCircle2, ExternalLink, Eye, EyeOff, Plus, RefreshCw, ShieldCheck, Upload, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseLote } from '@/lib/monitoramento-clientes/cadastro'
import { formatarDocumento } from '@/lib/monitoramento-clientes/documento'
import { dataBR, formatarNumeroCNJ } from '@/lib/monitoramento-clientes/formatar'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DocumentoMonitorado {
  id: string
  documento: string
  tipo: 'cpf' | 'cnpj'
  nome_principal: string
  nomes_busca: string[]
  ativo: boolean
  contrato_ref: string | null
  vigencia_inicio: string | null
  vigencia_fim: string | null
  ultima_busca_em: string | null
  cliente: { id: string; nome: string } | null
  alertas_novos: number
}

interface Alerta {
  id: string
  numero_processo: string
  tribunal: string | null
  orgao: string | null
  polo: string | null
  tipo_comunicacao: string | null
  data_disponibilizacao: string | null
  nome_encontrado: string | null
  link: string | null
  possivel_homonimo: boolean
  monitoramento: { id: string; nome_principal: string; documento: string; tipo: 'cpf' | 'cnpj' } | null
}

type StatusTratamento = 'visto' | 'descartado' | 'processo_cadastrado'

const inputCls = 'rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)] focus:outline-none focus:border-[var(--color-copper)] focus:ring-2 focus:ring-[var(--color-copper)]/10 transition-colors w-full'
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-3)] mb-1'
const cardCls = 'bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-[0_12px_36px_rgba(13,34,53,0.05)]'

function dataHoraBR(iso: string | null) {
  if (!iso) return 'nunca'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'nunca'
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
}

async function chamar<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; dados: T & { error?: string; migracaoPendente?: boolean } }> {
  const res = await fetch(url, init)
  const dados = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, dados }
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ClientesMonitoradosPage({ podeEditar }: { podeEditar: boolean }) {
  const [documentos, setDocumentos] = useState<DocumentoMonitorado[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [migracaoPendente, setMigracaoPendente] = useState(false)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const [a, d] = await Promise.all([
        chamar<{ alertas: Alerta[] }>('/api/monitoramento/clientes/alertas?status=novo'),
        chamar<{ documentos: DocumentoMonitorado[] }>('/api/monitoramento/clientes'),
      ])
      if (a.dados.migracaoPendente || d.dados.migracaoPendente) { setMigracaoPendente(true); return }
      if (!a.ok) throw new Error(a.dados.error ?? 'Falha ao carregar os alertas.')
      if (!d.ok) throw new Error(d.dados.error ?? 'Falha ao carregar os documentos.')
      setMigracaoPendente(false)
      setAlertas(a.dados.alertas ?? [])
      setDocumentos(d.dados.documentos ?? [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  async function tratarAlerta(id: string, status: StatusTratamento) {
    setOcupado(id)
    setAviso(null)
    const r = await chamar(`/api/monitoramento/clientes/alertas/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    setOcupado(null)
    if (!r.ok) { setAviso({ ok: false, texto: r.dados.error ?? 'Não foi possível atualizar o alerta.' }); return }
    setAlertas(lista => lista.filter(a => a.id !== id))
    setDocumentos(lista => lista.map(d => {
      const alvo = alertas.find(a => a.id === id)?.monitoramento?.id
      return d.id === alvo ? { ...d, alertas_novos: Math.max(0, d.alertas_novos - 1) } : d
    }))
  }

  async function alternarAtivo(doc: DocumentoMonitorado) {
    setOcupado(doc.id)
    setAviso(null)
    const r = await chamar(`/api/monitoramento/clientes/${doc.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo: !doc.ativo }),
    })
    setOcupado(null)
    if (!r.ok) { setAviso({ ok: false, texto: r.dados.error ?? 'Não foi possível alterar o monitoramento.' }); return }
    setDocumentos(lista => lista.map(d => d.id === doc.id ? { ...d, ativo: !doc.ativo } : d))
  }

  async function salvarNomes(doc: DocumentoMonitorado, nomePrincipal: string, alternativos: string) {
    setOcupado(doc.id)
    setAviso(null)
    const r = await chamar<{ documento: DocumentoMonitorado }>(`/api/monitoramento/clientes/${doc.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome_principal: nomePrincipal, nomes_busca: alternativos }),
    })
    setOcupado(null)
    if (!r.ok) { setAviso({ ok: false, texto: r.dados.error ?? 'Não foi possível salvar os nomes.' }); return false }
    setDocumentos(lista => lista.map(d => d.id === doc.id
      ? { ...d, nome_principal: r.dados.documento.nome_principal, nomes_busca: r.dados.documento.nomes_busca }
      : d))
    return true
  }

  async function cadastrar(itens: Array<Record<string, unknown>>): Promise<boolean> {
    setAviso(null)
    const r = await chamar<{ criados?: number; erros?: Array<{ documento: string | null; erro: string }> }>('/api/monitoramento/clientes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentos: itens }),
    })
    const erros = r.dados.erros ?? []
    const detalhe = erros.length ? ` Problemas: ${erros.map(e => `${e.documento ? formatarDocumento(e.documento) + ' — ' : ''}${e.erro}`).join(' · ')}` : ''
    if (!r.ok && !r.dados.criados) {
      setAviso({ ok: false, texto: (r.dados.error ?? 'Nenhum documento foi cadastrado.') + detalhe })
      return false
    }
    setAviso({ ok: erros.length === 0, texto: `${r.dados.criados ?? 0} documento(s) cadastrado(s).${detalhe}` })
    await carregar()
    return true
  }

  const ativos = documentos.filter(d => d.ativo).length

  return (
    <div className="space-y-5 max-w-6xl">

      {/* ── Cabeçalho ── */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 sm:px-7 sm:py-6 shadow-[0_18px_48px_rgba(13,34,53,0.06)]">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[var(--color-petrol-light)] to-transparent pointer-events-none" />
        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-copper)] mb-2">Operacional</p>
            <h1 className="font-brand text-[34px] font-semibold text-[var(--color-ink)] tracking-tight leading-none">Clientes monitorados</h1>
            <p className="text-[13px] text-[var(--color-ink-3)] mt-2 max-w-xl">
              Avisa quando surge processo novo envolvendo o cliente (principalmente no polo passivo) que o escritório ainda não cadastrou.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Link
              href="/monitoramento"
              className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-petrol)] bg-white border border-[var(--color-border)] px-3 py-2 rounded-xl hover:border-[var(--color-copper)] hover:bg-[var(--color-surface-warm)] transition-colors"
            >
              <ExternalLink size={12} /> Monitoramento de publicações
            </Link>
            <button
              onClick={() => void carregar()}
              disabled={carregando}
              className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-[var(--color-petrol)] bg-white border border-[var(--color-border)] rounded-xl hover:border-[var(--color-copper)] transition-colors disabled:opacity-60"
            >
              <RefreshCw size={12} className={carregando ? 'animate-spin' : ''} /> Atualizar
            </button>
          </div>
        </div>
      </div>

      {migracaoPendente && (
        <div className={cn(cardCls, 'p-6')}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-[var(--color-copper)] mt-0.5 shrink-0" />
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">Ative o monitoramento de clientes</h2>
              <p className="text-[13px] text-[var(--color-ink-2)] mt-1 leading-relaxed">
                As tabelas ainda não existem no banco. Execute o arquivo{' '}
                <code className="font-mono text-[12px] bg-[var(--color-surface-warm)] border border-[var(--color-border)] px-1.5 py-0.5 rounded">supabase/monitoramento_clientes_migration.sql</code>{' '}
                no SQL Editor do Supabase e recarregue a página.
              </p>
            </div>
          </div>
        </div>
      )}

      {erro && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{erro}</div>
      )}
      {aviso && (
        <div role="status" className={cn('rounded-xl border px-4 py-3 text-[13px]', aviso.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800')}>
          {aviso.texto}
        </div>
      )}

      {!migracaoPendente && (
        <>
          {/* ── (a) Alertas novos ── */}
          <section aria-labelledby="titulo-alertas" className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 id="titulo-alertas" className="text-[15px] font-semibold text-[var(--color-ink)]">Alertas novos</h2>
              <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', alertas.length ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200')}>
                {alertas.length}
              </span>
            </div>

            {carregando && alertas.length === 0 ? (
              <p className="text-[13px] text-[var(--color-ink-3)]">Carregando…</p>
            ) : alertas.length === 0 ? (
              <div className={cn(cardCls, 'p-6 flex items-center gap-3')}>
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <p className="text-[13px] text-[var(--color-ink-2)]">
                  Nenhum processo novo pendente. A busca roda todo dia pelo DJEN e só avisa de processos que ainda não estão cadastrados.
                </p>
              </div>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {alertas.map(a => (
                  <AlertaCard key={a.id} alerta={a} podeEditar={podeEditar} ocupado={ocupado === a.id} onTratar={tratarAlerta} />
                ))}
              </ul>
            )}
          </section>

          {/* ── (b) Documentos monitorados ── */}
          <section aria-labelledby="titulo-documentos" className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 id="titulo-documentos" className="text-[15px] font-semibold text-[var(--color-ink)]">Documentos monitorados</h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
                {ativos} ativo{ativos === 1 ? '' : 's'} de {documentos.length}
              </span>
            </div>

            <div className={cn(cardCls, 'overflow-x-auto')}>
              {documentos.length === 0 ? (
                <p className="p-6 text-[13px] text-[var(--color-ink-3)]">
                  {carregando ? 'Carregando…' : 'Nenhum documento monitorado ainda.'}
                </p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--color-ink-3)] border-b border-[var(--color-border)]">
                      <th className="px-4 py-3 font-semibold">Nome</th>
                      <th className="px-4 py-3 font-semibold">CPF/CNPJ</th>
                      <th className="px-4 py-3 font-semibold">Cliente no sistema</th>
                      <th className="px-4 py-3 font-semibold">Vigência</th>
                      <th className="px-4 py-3 font-semibold">Última busca</th>
                      <th className="px-4 py-3 font-semibold">Ativo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentos.map(d => (
                      <LinhaDocumento key={d.id} doc={d} podeEditar={podeEditar} ocupado={ocupado === d.id} onAlternar={alternarAtivo} onSalvarNomes={salvarNomes} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {podeEditar ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <FormularioDocumento onCadastrar={cadastrar} />
                <FormularioLote onCadastrar={cadastrar} />
              </div>
            ) : (
              <p className="text-[12px] text-[var(--color-ink-3)]">Somente sócios e gerentes cadastram documentos e tratam alertas.</p>
            )}

            <p className="text-[12px] text-[var(--color-ink-3)] leading-relaxed">
              Como funciona: o DJEN só pesquisa por nome, então a busca usa o nome do cliente e só vale quando o nome da parte for igual ao monitorado.
              Para CPF pode haver homônimo; confira antes de cadastrar o processo. O monitoramento só enxerga o que for publicado no DJEN.
            </p>
          </section>
        </>
      )}
    </div>
  )
}

// ─── Card de alerta ───────────────────────────────────────────────────────────

function AlertaCard({ alerta: a, podeEditar, ocupado, onTratar }: {
  alerta: Alerta
  podeEditar: boolean
  ocupado: boolean
  onTratar: (id: string, status: StatusTratamento) => void
}) {
  const passivo = a.polo === 'P'
  return (
    <li className={cn(cardCls, 'p-4 space-y-3', passivo && 'border-red-300 shadow-[0_12px_36px_rgba(185,28,28,0.10)]')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--color-ink)] truncate">{a.monitoramento?.nome_principal ?? a.nome_encontrado ?? 'Cliente'}</p>
          <p className="font-mono text-[13px] text-[var(--color-petrol)] mt-0.5 break-all">{formatarNumeroCNJ(a.numero_processo)}</p>
        </div>
        <span className={cn(
          'shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border',
          passivo ? 'bg-red-50 text-red-700 border-red-200'
            : a.polo === 'A' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-100 text-slate-600 border-slate-200',
        )}>
          {passivo ? 'Polo passivo (réu)' : a.polo === 'A' ? 'Polo ativo (autor)' : 'Polo não informado'}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
        <div><dt className="text-[var(--color-ink-3)]">Tribunal</dt><dd className="text-[var(--color-ink)]">{a.tribunal ?? '—'}</dd></div>
        <div><dt className="text-[var(--color-ink-3)]">Disponibilizado em</dt><dd className="text-[var(--color-ink)]">{a.data_disponibilizacao ? dataBR(a.data_disponibilizacao) : '—'}</dd></div>
        <div><dt className="text-[var(--color-ink-3)]">Tipo</dt><dd className="text-[var(--color-ink)]">{a.tipo_comunicacao ?? '—'}</dd></div>
        <div><dt className="text-[var(--color-ink-3)]">Órgão</dt><dd className="text-[var(--color-ink)] truncate" title={a.orgao ?? undefined}>{a.orgao ?? '—'}</dd></div>
      </dl>

      {a.possivel_homonimo && (
        <p className="flex items-start gap-1.5 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Possível homônimo: cliente pessoa física, e o DJEN só informa o nome. Confira antes de cadastrar.
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap pt-1">
        {a.link && (
          <a href={a.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-petrol)] bg-white border border-[var(--color-border)] px-3 py-1.5 rounded-lg hover:border-[var(--color-copper)] transition-colors">
            <ExternalLink size={12} /> Ver no DJEN
          </a>
        )}
        {podeEditar && (
          <>
            <button disabled={ocupado} onClick={() => onTratar(a.id, 'processo_cadastrado')} className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-teal-700 hover:bg-teal-800 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">
              <CheckCircle2 size={12} /> Já cadastrei o processo
            </button>
            <button disabled={ocupado} onClick={() => onTratar(a.id, 'visto')} className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-ink-2)] bg-white border border-[var(--color-border)] px-3 py-1.5 rounded-lg hover:border-[var(--color-copper)] transition-colors disabled:opacity-60">
              <Eye size={12} /> Visto
            </button>
            <button disabled={ocupado} onClick={() => onTratar(a.id, 'descartado')} className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-ink-3)] bg-white border border-[var(--color-border)] px-3 py-1.5 rounded-lg hover:border-red-300 hover:text-red-700 transition-colors disabled:opacity-60">
              <EyeOff size={12} /> Descartar
            </button>
          </>
        )}
      </div>
    </li>
  )
}

// ─── Linha da tabela de documentos ────────────────────────────────────────────

function LinhaDocumento({ doc, podeEditar, ocupado, onAlternar, onSalvarNomes }: {
  doc: DocumentoMonitorado
  podeEditar: boolean
  ocupado: boolean
  onAlternar: (d: DocumentoMonitorado) => void
  onSalvarNomes: (d: DocumentoMonitorado, nome: string, alternativos: string) => Promise<boolean | undefined>
}) {
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(doc.nome_principal)
  const [alternativos, setAlternativos] = useState((doc.nomes_busca ?? []).join('; '))

  return (
    <>
      <tr className={cn('border-b border-[var(--color-border)] last:border-0', !doc.ativo && 'opacity-60')}>
        <td className="px-4 py-3 align-top">
          <p className="font-medium text-[var(--color-ink)]">{doc.nome_principal}</p>
          {doc.nomes_busca?.length > 0 && <p className="text-[11px] text-[var(--color-ink-3)]">também: {doc.nomes_busca.join('; ')}</p>}
          {doc.alertas_novos > 0 && <span className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">{doc.alertas_novos} alerta(s) novo(s)</span>}
          {podeEditar && (
            <button onClick={() => setEditando(e => !e)} className="block mt-1 text-[11px] text-[var(--color-petrol)] hover:underline">
              {editando ? 'Fechar edição' : 'Editar nomes'}
            </button>
          )}
        </td>
        <td className="px-4 py-3 align-top whitespace-nowrap">
          <span className="font-mono text-[12px]">{formatarDocumento(doc.documento)}</span>
          <span className="ml-1.5 text-[10px] uppercase text-[var(--color-ink-3)]">{doc.tipo}</span>
        </td>
        <td className="px-4 py-3 align-top">
          {doc.cliente
            ? <Link href={`/clientes/${doc.cliente.id}`} className="inline-flex items-center gap-1 text-[var(--color-petrol)] hover:underline"><Users size={12} />{doc.cliente.nome}</Link>
            : <span className="text-[var(--color-ink-3)]">sem vínculo</span>}
        </td>
        <td className="px-4 py-3 align-top whitespace-nowrap text-[12px]">
          {doc.vigencia_inicio || doc.vigencia_fim
            ? `${doc.vigencia_inicio ? dataBR(doc.vigencia_inicio) : '…'} a ${doc.vigencia_fim ? dataBR(doc.vigencia_fim) : '…'}`
            : 'sem prazo'}
        </td>
        <td className="px-4 py-3 align-top whitespace-nowrap text-[12px]">{dataHoraBR(doc.ultima_busca_em)}</td>
        <td className="px-4 py-3 align-top">
          <button
            role="switch"
            aria-checked={doc.ativo}
            aria-label={`${doc.ativo ? 'Desativar' : 'Ativar'} monitoramento de ${doc.nome_principal}`}
            disabled={!podeEditar || ocupado}
            onClick={() => onAlternar(doc)}
            className={cn(
              'text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors disabled:cursor-default',
              doc.ativo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200',
            )}
          >
            {doc.ativo ? 'Ativo' : 'Pausado'}
          </button>
        </td>
      </tr>
      {editando && (
        <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-warm)]">
          <td colSpan={6} className="px-4 py-3">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
              <div>
                <label className={labelCls} htmlFor={`nome-${doc.id}`}>Nome do cliente</label>
                <input id={`nome-${doc.id}`} className={inputCls} value={nome} onChange={e => setNome(e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor={`alt-${doc.id}`}>Nomes alternativos (separe com ;)</label>
                <input id={`alt-${doc.id}`} className={inputCls} value={alternativos} onChange={e => setAlternativos(e.target.value)} />
              </div>
              <button
                disabled={ocupado}
                onClick={async () => { if (await onSalvarNomes(doc, nome, alternativos)) setEditando(false) }}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-60"
              >
                Salvar
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Cadastro individual ──────────────────────────────────────────────────────

function FormularioDocumento({ onCadastrar }: { onCadastrar: (itens: Array<Record<string, unknown>>) => Promise<boolean> }) {
  const [documento, setDocumento] = useState('')
  const [nome, setNome] = useState('')
  const [alternativo, setAlternativo] = useState('')
  const [contrato, setContrato] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    const ok = await onCadastrar([{
      documento, nome_principal: nome, nomes_busca: alternativo,
      contrato_ref: contrato, vigencia_inicio: inicio, vigencia_fim: fim,
    }])
    setEnviando(false)
    if (ok) { setDocumento(''); setNome(''); setAlternativo(''); setContrato(''); setInicio(''); setFim('') }
  }

  return (
    <form onSubmit={enviar} className={cn(cardCls, 'p-5 space-y-3')}>
      <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--color-ink)]"><Plus size={15} /> Cadastrar documento</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="doc-documento">CPF ou CNPJ</label>
          <input id="doc-documento" className={inputCls} required inputMode="numeric" placeholder="00.000.000/0000-00" value={documento} onChange={e => setDocumento(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="doc-nome">Nome do cliente</label>
          <input id="doc-nome" className={inputCls} required placeholder="Como aparece nos processos" value={nome} onChange={e => setNome(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="doc-alt">Nome alternativo (opcional; vários com ;)</label>
          <input id="doc-alt" className={inputCls} placeholder="Ex.: nome fantasia, grafia antiga" value={alternativo} onChange={e => setAlternativo(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="doc-contrato">Contrato (referência)</label>
          <input id="doc-contrato" className={inputCls} value={contrato} onChange={e => setContrato(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls} htmlFor="doc-inicio">Vigência de</label>
            <input id="doc-inicio" type="date" className={inputCls} value={inicio} onChange={e => setInicio(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="doc-fim">até</label>
            <input id="doc-fim" type="date" className={inputCls} value={fim} onChange={e => setFim(e.target.value)} />
          </div>
        </div>
      </div>
      <button disabled={enviando} className="flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-60">
        <ShieldCheck size={13} /> {enviando ? 'Cadastrando…' : 'Monitorar'}
      </button>
    </form>
  )
}

// ─── Colar em lote ────────────────────────────────────────────────────────────

function FormularioLote({ onCadastrar }: { onCadastrar: (itens: Array<Record<string, unknown>>) => Promise<boolean> }) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const previa = useMemo(() => parseLote(texto), [texto])

  async function enviar() {
    if (previa.linhas.length === 0) return
    setEnviando(true)
    const ok = await onCadastrar(previa.linhas.map(l => ({
      documento: l.documento, nome_principal: l.nome_principal, nomes_busca: l.nomes_busca,
    })))
    setEnviando(false)
    if (ok) setTexto('')
  }

  return (
    <div className={cn(cardCls, 'p-5 space-y-3')}>
      <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--color-ink)]"><Upload size={15} /> Colar em lote</h3>
      <div>
        <label className={labelCls} htmlFor="lote-texto">Uma linha por documento</label>
        <textarea
          id="lote-texto"
          rows={6}
          className={cn(inputCls, 'font-mono text-[12px]')}
          placeholder={'CNPJ ou CPF; nome do cliente; nome alternativo (opcional)\n11.222.333/0001-81; Empresa Exemplo Ltda; Exemplo Comércio'}
          value={texto}
          onChange={e => setTexto(e.target.value)}
        />
      </div>
      {texto.trim() && (
        <div className="text-[12px] space-y-1">
          <p className="text-[var(--color-ink-2)]">{previa.linhas.length} linha(s) válida(s){previa.erros.length ? `, ${previa.erros.length} com problema` : ''}.</p>
          {previa.erros.length > 0 && (
            <ul className="text-red-700 space-y-0.5">
              {previa.erros.map(e => <li key={e.linha}>Linha {e.linha}: {e.erro}</li>)}
            </ul>
          )}
        </div>
      )}
      <button
        onClick={() => void enviar()}
        disabled={enviando || previa.linhas.length === 0}
        className="flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-60"
      >
        <Upload size={13} /> {enviando ? 'Cadastrando…' : `Cadastrar ${previa.linhas.length || ''} documento(s)`}
      </button>
    </div>
  )
}
