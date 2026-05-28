'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, DatabaseZap, ExternalLink, Loader2, Play, ShieldCheck, XCircle } from 'lucide-react'

export const SECURITY_MESSAGE =
  'Este sistema não automatiza login em tribunais, certificado digital, gov.br, jus.br ou MFA. Para atos processuais, use sempre o sistema oficial do tribunal.'

interface ProviderView {
  id: string
  nome: string
  descricao: string
  ativo: boolean
  configurado: boolean
  modo: 'desenvolvimento' | 'externo'
  aceitaCredenciaisNoSistema: false
}

interface LogView {
  id: string
  provider: string
  tipo_operacao: string
  status: 'sucesso' | 'erro'
  referencia: string | null
  mensagem: string | null
  iniciado_em: string
  finalizado_em: string | null
}

interface SyncResultado {
  processo: {
    numeroCnj: string
    classe?: string
    tribunal?: string
    status?: string
    partes: Array<{ nome: string; tipo?: string }>
  } | null
  movimentacoes: Array<{ id: string; titulo: string; data: string }>
  publicacoes: Array<{ id: string; texto: string; dataPublicacao: string }>
}

const OFFICIAL_LINKS = [
  { nome: 'PJe', href: 'https://www.pje.jus.br/' },
  { nome: 'eproc', href: 'https://eproc.jus.br/eproc/' },
  { nome: 'ESAJ', href: 'https://esaj.tjsp.jus.br/' },
  { nome: 'Projudi', href: 'https://projudi.tjpr.jus.br/projudi/' },
  { nome: 'DJEN/CNJ', href: 'https://comunica.pje.jus.br/' },
]

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? 'Erro na requisicao')
  return body as T
}

export default function IntegracoesProcessuaisPage() {
  const [providers, setProviders] = useState<ProviderView[]>([])
  const [logs, setLogs] = useState<LogView[]>([])
  const [numeroCnj, setNumeroCnj] = useState('0000000-00.2026.8.13.0000')
  const [resultado, setResultado] = useState<SyncResultado | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [erro, setErro] = useState('')

  const mockProvider = useMemo(() => providers.find(provider => provider.id === 'mock'), [providers])

  async function carregar() {
    setErro('')
    setLoading(true)
    try {
      const [providersBody, logsBody] = await Promise.all([
        fetchJson<{ providers: ProviderView[] }>('/api/integracoes-processuais/providers'),
        fetchJson<{ logs: LogView[] }>('/api/integracoes-processuais/logs?limit=8'),
      ])
      setProviders(providersBody.providers)
      setLogs(logsBody.logs)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar integracoes')
    } finally {
      setLoading(false)
    }
  }

  async function testarMock() {
    setErro('')
    setSyncing(true)
    setResultado(null)
    try {
      const body = await fetchJson<{ resultado: SyncResultado }>('/api/integracoes-processuais/sincronizar-processo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'mock', numeroCnj }),
      })
      setResultado(body.resultado)
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao testar provider')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col gap-2">
        <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight">Integrações Processuais</h1>
        <p className="text-[13px] text-[#7a8899]">
          Consulta e monitoramento por providers oficiais ou contratados, com segredos mantidos somente no servidor.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 flex gap-3">
        <ShieldCheck size={17} className="mt-0.5 shrink-0" />
        <p>{SECURITY_MESSAGE}</p>
      </div>

      {erro && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 flex gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {erro}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-[14px] font-semibold text-[#1a1d23]">Providers disponíveis</h2>
        {loading ? (
          <div className="h-24 rounded-lg border border-[#E2DDD8] bg-white flex items-center justify-center text-sm text-[#7a8899]">
            <Loader2 size={16} className="animate-spin mr-2" /> Carregando
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {providers.map(provider => (
              <div key={provider.id} className="rounded-lg border border-[#E2DDD8] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#1a1d23]">{provider.nome}</h3>
                    <p className="mt-1 text-[13px] text-[#7a8899] leading-relaxed">{provider.descricao}</p>
                  </div>
                  {provider.ativo ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      <CheckCircle2 size={12} /> Ativo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 ring-1 ring-zinc-200">
                      <XCircle size={12} /> Inativo
                    </span>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full bg-[#F3F1EE] px-2.5 py-1 text-[#5d6878]">{provider.modo}</span>
                  <span className="rounded-full bg-[#F3F1EE] px-2.5 py-1 text-[#5d6878]">
                    {provider.configurado ? 'Configurado' : 'Pendente de env server-side'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-[#E2DDD8] bg-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <DatabaseZap size={16} className="text-[#1D5F60]" />
          <h2 className="text-[14px] font-semibold text-[#1a1d23]">Teste seguro do provider mock</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={numeroCnj}
            onChange={event => setNumeroCnj(event.target.value)}
            className="min-h-10 flex-1 rounded-lg border border-[#E2DDD8] px-3 text-sm outline-none focus:border-[#1D5F60]"
            placeholder="Número CNJ"
          />
          <button
            onClick={testarMock}
            disabled={syncing || !mockProvider}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#1D5F60] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncing ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            Testar mock
          </button>
        </div>
        {resultado?.processo && (
          <div className="rounded-lg border border-[#E2DDD8] bg-[#FAF8F5] p-4 text-[13px] text-[#3d4a5c]">
            <p className="font-semibold text-[#1a1d23]">{resultado.processo.numeroCnj}</p>
            <p className="mt-1">{resultado.processo.classe} · {resultado.processo.tribunal} · {resultado.processo.status}</p>
            <p className="mt-2">
              {resultado.movimentacoes.length} movimentações e {resultado.publicacoes.length} publicação retornadas pelo mock.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-[14px] font-semibold text-[#1a1d23]">Atalhos oficiais</h2>
        <div className="flex flex-wrap gap-2">
          {OFFICIAL_LINKS.map(link => (
            <a
              key={link.nome}
              href={link.href}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2DDD8] bg-white px-3 py-2 text-[13px] font-medium text-[#1D5F60] hover:border-[#1D5F60]"
            >
              {link.nome} <ExternalLink size={13} />
            </a>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[14px] font-semibold text-[#1a1d23]">Logs recentes</h2>
        <div className="overflow-hidden rounded-lg border border-[#E2DDD8] bg-white">
          {logs.length === 0 ? (
            <p className="p-4 text-sm text-[#7a8899]">Nenhum log registrado.</p>
          ) : (
            <div className="divide-y divide-[#F3F1EE]">
              {logs.map(log => (
                <div key={log.id} className="grid gap-2 p-4 text-[13px] md:grid-cols-[120px_1fr_110px]">
                  <span className="font-semibold text-[#1a1d23]">{log.provider}</span>
                  <div>
                    <p className="font-medium text-[#3d4a5c]">{log.referencia ?? log.tipo_operacao}</p>
                    <p className="text-[#7a8899]">{log.mensagem ?? 'Sem mensagem'}</p>
                  </div>
                  <span className={log.status === 'sucesso' ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
