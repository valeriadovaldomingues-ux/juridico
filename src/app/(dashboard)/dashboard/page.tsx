import { createClient }               from '@/lib/supabase/server'
import { createClient as svcClient }  from '@supabase/supabase-js'

// Service client singleton — contorna bug JWT do @supabase/ssr v0.9.0
let _svc: ReturnType<typeof svcClient> | null = null
function getServiceClient() {
  if (_svc) return _svc
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  _svc = svcClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return _svc
}
import Link from 'next/link'
import {
  Users, Scale, FolderCheck, Briefcase,
  Clock, ArrowUpRight, Activity, Plus, TrendingUp,
  TrendingDown, AlertCircle, DollarSign, Handshake,
} from 'lucide-react'
import AtividadesBlock from './_components/AtividadesBlock'
import ProdutividadeColaboradores from './_components/ProdutividadeColaboradores'
import { formatCurrency } from '@/lib/utils'

// ─── Funil comercial ─────────────────────────────────────────────────────────

const FUNIL_COMERCIAL = [
  { status: 'novo_lead',          label: 'Novo Lead',        color: 'bg-slate-400' },
  { status: 'contato_inicial',    label: 'Contato Inicial',  color: 'bg-blue-400' },
  { status: 'aguardando_retorno', label: 'Ag. Retorno',      color: 'bg-amber-400' },
  { status: 'reuniao_agendada',   label: 'Reunião Agendada', color: 'bg-purple-400' },
  { status: 'proposta_enviada',   label: 'Proposta Enviada', color: 'bg-indigo-400' },
  { status: 'negociacao',         label: 'Em Negociação',    color: 'bg-orange-400' },
]

const statusLeadLabel: Record<string, string> = {
  novo_lead: 'Novo Lead', contato_inicial: 'Contato Inicial',
  aguardando_retorno: 'Ag. Retorno', reuniao_agendada: 'Reunião Agendada',
  proposta_enviada: 'Proposta Enviada', negociacao: 'Em Negociação',
  fechado: 'Fechado', perdido: 'Perdido',
}

const origemLeadLabel: Record<string, string> = {
  indicacao: 'Indicação', site: 'Site', instagram: 'Instagram',
  linkedin: 'LinkedIn', facebook: 'Facebook', google: 'Google',
  evento: 'Evento', outro: 'Outro',
}

// ─── Label / color maps ──────────────────────────────────────────────────────

const tipoLabel: Record<string, string> = {
  audiencia:        'Audiência',
  prazo_processual: 'Prazo',
  reuniao:          'Reunião',
  diligencia:       'Diligência',
  outro:            'Outro',
}

const tipoBadge: Record<string, string> = {
  audiencia:        'bg-violet-50 text-violet-700 border border-violet-100',
  prazo_processual: 'bg-rose-50   text-rose-700   border border-rose-100',
  reuniao:          'bg-blue-50   text-blue-700   border border-blue-100',
  diligencia:       'bg-amber-50  text-amber-700  border border-amber-100',
  outro:            'bg-slate-50  text-slate-600  border border-slate-200',
}

const areaLabel: Record<string, string> = {
  civil:          'Cível',
  trabalhista:    'Trabalhista',
  criminal:       'Criminal',
  tributario:     'Tributário',
  previdenciario: 'Previdenciário',
  administrativo: 'Administrativo',
  familia:        'Família',
  empresarial:    'Empresarial',
  outro:          'Outro',
}

const areaColor: Record<string, string> = {
  civil:          'bg-blue-400',
  trabalhista:    'bg-violet-400',
  criminal:       'bg-rose-400',
  tributario:     'bg-amber-400',
  previdenciario: 'bg-teal-400',
  administrativo: 'bg-indigo-400',
  familia:        'bg-pink-400',
  empresarial:    'bg-sky-400',
  outro:          'bg-slate-400',
}

const statusLabel: Record<string, string> = {
  ativo:     'Ativo',
  suspenso:  'Suspenso',
  arquivado: 'Arquivado',
  encerrado: 'Encerrado',
}

const statusBarColor: Record<string, string> = {
  ativo:     'bg-emerald-400',
  suspenso:  'bg-amber-400',
  arquivado: 'bg-slate-400',
  encerrado: 'bg-blue-400',
}

const statusBadge: Record<string, string> = {
  ativo:     'bg-emerald-50 text-emerald-700 border border-emerald-100',
  suspenso:  'bg-amber-50   text-amber-700   border border-amber-100',
  arquivado: 'bg-slate-50   text-slate-600   border border-slate-200',
  encerrado: 'bg-blue-50    text-blue-700    border border-blue-100',
}

// ─── Date helper ─────────────────────────────────────────────────────────────

function formatPrazoDate(dateStr: string, todayStr: string): { label: string; cls: string } {
  if (dateStr < todayStr) {
    const days = Math.round(
      (new Date(todayStr).getTime() - new Date(dateStr).getTime()) / 86_400_000,
    )
    return { label: days === 1 ? 'Ontem' : `${days}d atrás`, cls: 'bg-rose-50 text-rose-700 font-semibold border border-rose-100' }
  }
  if (dateStr === todayStr) {
    return { label: 'Hoje', cls: 'bg-amber-50 text-amber-700 font-semibold border border-amber-100' }
  }
  const tom = new Date(todayStr)
  tom.setDate(tom.getDate() + 1)
  if (dateStr === tom.toISOString().split('T')[0]) {
    return { label: 'Amanhã', cls: 'bg-[#E8F2F2] text-[#1D5F60] border border-[#E2DDD8]' }
  }
  const [, m, d] = dateStr.split('-')
  return { label: `${d}/${m}`, cls: 'bg-[#F3F1EE] text-[#7a8899] border border-[#E2DDD8]' }
}

// ─── Shared card class ───────────────────────────────────────────────────────

const card = 'bg-white rounded-lg border border-[#E2DDD8] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden'

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const sevenDaysLater = new Date(today)
  sevenDaysLater.setDate(today.getDate() + 7)
  const sevenDaysLaterStr = sevenDaysLater.toISOString().split('T')[0]

  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)

  // Role para exibição condicional do resumo financeiro
  // Usa service role para contornar bug JWT do @supabase/ssr v0.9.0
  const { data: { user } } = await supabase.auth.getUser()
  const client = getServiceClient() ?? supabase
  const { data: profileData } = user
    ? await client.from('profiles').select('role').eq('id', user.id).maybeSingle()
    : { data: null }
  const userRole = profileData?.role ?? 'estagiario'
  const verFinanceiro = userRole === 'socio'
  const verComercial  = ['socio', 'comercial'].includes(userRole)

  const [
    { count: totalClientes },
    { count: totalProcessosAtivos },
    { count: totalProcessosEncerrados },
    { data: processosDistribuicao },
    { data: todasAtividades },
    { data: proximosPrazos },
    { data: prazosRecentes },
    { data: ultimosProcessos },
    { data: ultimosClientes },
    finResult,
    leadsResult,
    ultimosLeadsResult,
  ] = await Promise.all([
    supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('ativo', true),
    supabase.from('processos').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase.from('processos').select('*', { count: 'exact', head: true }).eq('status', 'encerrado'),
    supabase.from('processos').select('area_direito, status'),
    supabase.from('prazos').select('id, status, data_final').neq('status', 'cancelado').order('data_final', { ascending: true }),
    supabase.from('prazos')
      .select('id, titulo, tipo, prioridade, data_final, processo:processos(id, titulo)')
      .eq('status', 'pendente')
      .lte('data_final', sevenDaysLaterStr)
      .order('data_final', { ascending: true })
      .limit(8),
    supabase.from('prazos').select('processo_id').gte('created_at', thirtyDaysAgo.toISOString()).not('processo_id', 'is', null),
    supabase.from('processos').select('id, titulo, area_direito, status, created_at, cliente:clientes(nome)').order('created_at', { ascending: false }).limit(5),
    supabase.from('clientes').select('id, nome, cidade, uf, created_at').eq('ativo', true).order('created_at', { ascending: false }).limit(5),
    verFinanceiro
      ? supabase.from('financeiro_lancamentos').select('tipo, valor, status, vencimento').neq('status', 'cancelado')
      : Promise.resolve({ data: null }),
    verComercial
      ? supabase.from('leads').select('status')
      : Promise.resolve({ data: null }),
    verComercial
      ? supabase.from('leads').select('id, nome, status, origem, created_at, responsavel:profiles!responsavel_id(nome)').order('created_at', { ascending: false }).limit(6)
      : Promise.resolve({ data: null }),
  ])

  // Resumo financeiro (gerente/socio)
  const finLancamentos = (finResult as any)?.data ?? []
  const mesAtual = today.getMonth()
  const anoAtual = today.getFullYear()
  const faturamentoMes = finLancamentos
    .filter((l: any) => {
      if (l.tipo !== 'receita' || l.status !== 'pago') return false
      const d = new Date(l.vencimento + 'T12:00:00')
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual
    })
    .reduce((s: number, l: any) => s + l.valor, 0)
  const aReceber = finLancamentos
    .filter((l: any) => l.tipo === 'receita' && l.status === 'pendente')
    .reduce((s: number, l: any) => s + l.valor, 0)
  const vencidos = finLancamentos
    .filter((l: any) => l.status === 'vencido')
    .reduce((s: number, l: any) => s + l.valor, 0)

  // Agregações comerciais
  const leadsData = (leadsResult as any)?.data ?? []
  const leadsPorStatus: Record<string, number> = {}
  for (const lead of leadsData) {
    leadsPorStatus[lead.status] = (leadsPorStatus[lead.status] ?? 0) + 1
  }
  const maxLeadCount   = Math.max(...FUNIL_COMERCIAL.map(f => leadsPorStatus[f.status] ?? 0), 1)
  const totalLeadsAtivos  = FUNIL_COMERCIAL.reduce((s, f) => s + (leadsPorStatus[f.status] ?? 0), 0)
  const leadsConvertidos  = leadsPorStatus['fechado'] ?? 0
  const ultimosLeads   = (ultimosLeadsResult as any)?.data ?? []

  // Aggregations
  const areaCounts = (processosDistribuicao ?? []).reduce((acc: Record<string, number>, p: any) => {
    acc[p.area_direito] = (acc[p.area_direito] ?? 0) + 1; return acc
  }, {})
  const statusCounts = (processosDistribuicao ?? []).reduce((acc: Record<string, number>, p: any) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1; return acc
  }, {})

  const totalProcessos  = processosDistribuicao?.length ?? 0
  const areaEntries     = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])
  const statusEntries   = Object.entries(statusCounts).sort((a, b) => b[1] - a[1])
  const maxAreaCount    = areaEntries[0]?.[1]   ?? 1
  const maxStatusCount  = statusEntries[0]?.[1] ?? 1

  // Movimentações
  const processosComMovimentacao  = new Set((prazosRecentes ?? []).map((p: any) => p.processo_id)).size
  const processosSemMovimentacao  = Math.max(0, (totalProcessosAtivos ?? 0) - processosComMovimentacao)
  const movPct = (totalProcessosAtivos ?? 0) > 0
    ? Math.round((processosComMovimentacao / (totalProcessosAtivos ?? 1)) * 100) : 0

  return (
    <div className="space-y-6 max-w-7xl">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-[#0f1923] tracking-tight leading-tight">
            Área de Trabalho
          </h1>
          <p className="text-[13px] text-[#9aabb8] mt-0.5 capitalize">
            {today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link
          href="/agenda"
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1D5F60] hover:bg-[#27777A] active:scale-[0.97] text-white text-[13px] font-semibold rounded-xl transition-all duration-150 shadow-sm"
        >
          <Plus size={14} strokeWidth={2.5} />
          Nova Tarefa
        </Link>
      </div>

      {/* ── KPI strip ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-5">

        {/* Featured: Processos Ativos */}
        <Link
          href="/processos"
          className="group relative bg-gradient-to-br from-[#162030] via-[#1D5F60] to-[#27777A] rounded-lg p-6 shadow-md hover:shadow-xl hover:-translate-y-1 active:translate-y-0 transition-all duration-200 overflow-hidden"
        >
          {/* Decorative */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/[0.06] pointer-events-none" />
          <div className="absolute bottom-0 right-4 w-20 h-20 rounded-full bg-white/[0.04] pointer-events-none" />
          <div className="relative">
            <div className="flex items-start justify-between mb-5">
              <div className="w-10 h-10 rounded-xl bg-white/[0.15] flex items-center justify-center">
                <TrendingUp size={18} className="text-white" />
              </div>
              <ArrowUpRight size={15} className="text-white/30 group-hover:text-white/60 transition-colors" />
            </div>
            <p className="text-[48px] font-black text-white leading-none tracking-tight">
              {totalProcessosAtivos ?? 0}
            </p>
            <p className="text-[11px] text-white/50 mt-2.5 font-medium tracking-widest uppercase">
              Processos Ativos
            </p>
          </div>
        </Link>

        {/* Total de Processos */}
        <Link
          href="/processos"
          className="group bg-white rounded-lg border border-[#E2DDD8] p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-[#1D5F60]/30 transition-all duration-200"
        >
          <div className="flex items-start justify-between mb-5">
            <div className="w-10 h-10 rounded-xl bg-[#E8F2F2] flex items-center justify-center">
              <Scale size={18} className="text-[#1D5F60]" />
            </div>
            <ArrowUpRight size={14} className="text-[#D8E2E2] group-hover:text-[#9aabb8] transition-colors" />
          </div>
          <p className="text-[38px] font-bold text-[#0f1923] leading-none tracking-tight">{totalProcessos}</p>
          <p className="text-[12px] text-[#9aabb8] mt-2 font-medium">Total de Processos</p>
        </Link>

        {/* Encerrados */}
        <Link
          href="/processos"
          className="group bg-white rounded-lg border border-[#E2DDD8] p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-[#1D5F60]/30 transition-all duration-200"
        >
          <div className="flex items-start justify-between mb-5">
            <div className="w-10 h-10 rounded-xl bg-[#e6f4ea] flex items-center justify-center">
              <FolderCheck size={18} className="text-[#2d7a3a]" />
            </div>
            <ArrowUpRight size={14} className="text-[#D8E2E2] group-hover:text-[#9aabb8] transition-colors" />
          </div>
          <p className="text-[38px] font-bold text-[#0f1923] leading-none tracking-tight">{totalProcessosEncerrados ?? 0}</p>
          <p className="text-[12px] text-[#9aabb8] mt-2 font-medium">Processos Encerrados</p>
        </Link>

        {/* Clientes */}
        <Link
          href="/clientes"
          className="group bg-white rounded-lg border border-[#E2DDD8] p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-[#1D5F60]/30 transition-all duration-200"
        >
          <div className="flex items-start justify-between mb-5">
            <div className="w-10 h-10 rounded-xl bg-[#fef3e2] flex items-center justify-center">
              <Users size={18} className="text-[#b8903a]" />
            </div>
            <ArrowUpRight size={14} className="text-[#D8E2E2] group-hover:text-[#9aabb8] transition-colors" />
          </div>
          <p className="text-[38px] font-bold text-[#0f1923] leading-none tracking-tight">{totalClientes ?? 0}</p>
          <p className="text-[12px] text-[#9aabb8] mt-2 font-medium">Total de Clientes</p>
        </Link>
      </div>

      {/* ── Resumo Financeiro (gerente / sócio) ──────────────────────────────── */}
      {verFinanceiro && (
        <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#F0F4F4]">
            <div className="flex items-center gap-2.5">
              <DollarSign size={14} className="text-[#9aabb8]" />
              <h2 className="text-[14px] font-semibold text-[#0f1923]">Resumo Financeiro</h2>
            </div>
            <Link href="/financeiro" className="text-[11px] text-[#b8903a] font-semibold hover:text-[#a07830] transition-colors">
              Ver detalhes →
            </Link>
          </div>
          <div className="grid grid-cols-3 divide-x divide-[#F0F4F4]">
            <div className="px-6 py-4">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-md bg-[#e6f4ee] flex items-center justify-center">
                  <TrendingUp size={12} className="text-[#2ecc71]" />
                </div>
                <p className="text-[11px] font-medium text-[#9aabb8]">Faturamento do mês</p>
              </div>
              <p className="text-[22px] font-bold text-[#1a7a45] tabular-nums">{formatCurrency(faturamentoMes)}</p>
            </div>
            <div className="px-6 py-4">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-md bg-[#e8f0fb] flex items-center justify-center">
                  <Clock size={12} className="text-[#3498db]" />
                </div>
                <p className="text-[11px] font-medium text-[#9aabb8]">A receber</p>
              </div>
              <p className="text-[22px] font-bold text-[#1a4d9e] tabular-nums">{formatCurrency(aReceber)}</p>
            </div>
            <div className="px-6 py-4">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-md bg-[#fde8e8] flex items-center justify-center">
                  <AlertCircle size={12} className="text-[#e74c3c]" />
                </div>
                <p className="text-[11px] font-medium text-[#9aabb8]">Vencidos</p>
              </div>
              <p className="text-[22px] font-bold text-[#a93226] tabular-nums">{formatCurrency(vencidos)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Bloco Comercial (comercial / sócio) ──────────────────────────────── */}
      {verComercial && (
        <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#F0F4F4]">
            <div className="flex items-center gap-2.5">
              <Handshake size={14} className="text-[#9aabb8]" />
              <h2 className="text-[14px] font-semibold text-[#0f1923]">Pipeline Comercial</h2>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[11px] text-[#9aabb8]">
                <span className="font-semibold text-[#0f1923]">{totalLeadsAtivos}</span> ativos ·{' '}
                <span className="font-semibold text-emerald-700">{leadsConvertidos}</span> convertidos
              </span>
              <Link href="/comercial" className="text-[11px] text-[#b8903a] font-semibold hover:text-[#a07830] transition-colors">
                Ver pipeline →
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-[#F0F4F4]">

            {/* Funil por etapa */}
            <div className="px-6 py-5 space-y-3.5">
              <p className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-widest mb-4">Etapas ativas</p>
              {FUNIL_COMERCIAL.map(({ status, label, color }) => {
                const count = leadsPorStatus[status] ?? 0
                const pct   = maxLeadCount > 0 ? Math.round((count / maxLeadCount) * 100) : 0
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] text-[#4a5a6a]">{label}</span>
                      <span className="text-[12px] font-bold text-[#0f1923]">{count}</span>
                    </div>
                    <div className="h-1.5 bg-[#F3F1EE] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Leads recentes */}
            <div className="px-6 py-5">
              <p className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-widest mb-4">Leads recentes</p>
              {ultimosLeads.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mx-auto mb-2">
                    <Handshake size={16} className="text-orange-300" />
                  </div>
                  <p className="text-[12px] text-[#9aabb8]">Nenhum lead cadastrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ultimosLeads.map((lead: any) => (
                    <Link key={lead.id} href="/comercial" className="flex items-center gap-3 group hover:opacity-80 transition-opacity">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <span className="text-[12px] font-bold text-orange-600">
                          {lead.nome.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#0f1923] truncate group-hover:text-[#1D5F60] transition-colors">
                          {lead.nome}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-[#9aabb8]">
                            {statusLeadLabel[lead.status] ?? lead.status}
                          </span>
                          {lead.origem && (
                            <>
                              <span className="text-[#D0DCDC]">·</span>
                              <span className="text-[10px] text-[#9aabb8]">
                                {origemLeadLabel[lead.origem] ?? lead.origem}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {lead.responsavel && (
                        <span className="text-[10px] text-[#9aabb8] flex-shrink-0 hidden md:block">
                          {lead.responsavel.nome}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Row 2: Atividades + Próximos Prazos ──────────────────────────────── */}
      <div className="grid grid-cols-3 gap-5">

        <AtividadesBlock atividades={todasAtividades ?? []} />

        {/* Próximos Prazos */}
        <div className={`col-span-2 ${card}`}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F4F4]">
            <div className="flex items-center gap-2.5">
              <Clock size={14} className="text-[#9aabb8]" />
              <h2 className="text-[14px] font-semibold text-[#0f1923]">Próximos Prazos</h2>
              <span className="text-[11px] text-[#9aabb8] bg-[#F3F1EE] px-2 py-0.5 rounded-md border border-[#E2DDD8]">
                7 dias
              </span>
            </div>
            <Link href="/agenda" className="text-[11px] text-[#b8903a] font-semibold hover:text-[#a07830] transition-colors">
              Ver todos →
            </Link>
          </div>

          {!proximosPrazos || proximosPrazos.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="w-12 h-12 rounded-lg bg-[#F3F1EE] flex items-center justify-center mx-auto mb-3">
                <Clock size={20} className="text-[#D0DCDC]" />
              </div>
              <p className="text-[13px] text-[#9aabb8]">Nenhum prazo pendente nos próximos 7 dias</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F7F9F9]">
              {proximosPrazos.map((prazo: any) => {
                const { label: dateLabel, cls: dateCls } = formatPrazoDate(prazo.data_final, todayStr)
                const isOverdue = prazo.data_final < todayStr
                const isToday   = prazo.data_final === todayStr
                return (
                  <div key={prazo.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-[#FAFBFB] transition-colors">
                    <div className={`w-[3px] h-10 rounded-full flex-shrink-0 ${isOverdue ? 'bg-rose-400' : isToday ? 'bg-amber-400' : 'bg-[#D0DCDC]'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-medium truncate ${isOverdue ? 'text-rose-800' : 'text-[#0f1923]'}`}>
                        {prazo.titulo}
                      </p>
                      {prazo.processo && (
                        <p className="text-[11px] text-[#9aabb8] truncate mt-0.5">{prazo.processo.titulo}</p>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0 ${tipoBadge[prazo.tipo] ?? 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                      {tipoLabel[prazo.tipo] ?? prazo.tipo}
                    </span>
                    <span className={`text-[11px] px-2.5 py-1 rounded-lg flex-shrink-0 ${dateCls}`}>
                      {dateLabel}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Por Área + Por Status + Movimentações ─────────────────────── */}
      <div className="grid grid-cols-3 gap-5">

        {/* Por Área */}
        <div className={card}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F4F4]">
            <div className="flex items-center gap-2.5">
              <Briefcase size={14} className="text-[#9aabb8]" />
              <h2 className="text-[14px] font-semibold text-[#0f1923]">Por Área</h2>
            </div>
            <span className="text-[11px] text-[#9aabb8] bg-[#F3F1EE] px-2 py-0.5 rounded-md border border-[#E2DDD8]">
              {totalProcessos} total
            </span>
          </div>
          <div className="px-6 py-5 space-y-4">
            {areaEntries.length === 0 ? (
              <p className="text-[13px] text-[#9aabb8] py-6 text-center">Nenhum processo</p>
            ) : areaEntries.map(([area, count]) => (
              <div key={area}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-medium text-[#4a5a6a]">{areaLabel[area] ?? area}</span>
                  <span className="text-[12px] font-bold text-[#0f1923]">{count}</span>
                </div>
                <div className="h-2 bg-[#F3F1EE] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${areaColor[area] ?? 'bg-slate-400'}`}
                    style={{ width: `${Math.round((count / maxAreaCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Por Status */}
        <div className={card}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F4F4]">
            <div className="flex items-center gap-2.5">
              <Scale size={14} className="text-[#9aabb8]" />
              <h2 className="text-[14px] font-semibold text-[#0f1923]">Por Status</h2>
            </div>
            <span className="text-[11px] text-[#9aabb8] bg-[#F3F1EE] px-2 py-0.5 rounded-md border border-[#E2DDD8]">
              {totalProcessos} total
            </span>
          </div>
          <div className="px-6 py-5 space-y-4">
            {statusEntries.length === 0 ? (
              <p className="text-[13px] text-[#9aabb8] py-6 text-center">Nenhum processo</p>
            ) : statusEntries.map(([status, count]) => (
              <div key={status}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-medium text-[#4a5a6a]">{statusLabel[status] ?? status}</span>
                  <span className="text-[12px] font-bold text-[#0f1923]">{count}</span>
                </div>
                <div className="h-2 bg-[#F3F1EE] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${statusBarColor[status] ?? 'bg-slate-400'}`}
                    style={{ width: `${Math.round((count / maxStatusCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Movimentações */}
        <div className={card}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F4F4]">
            <div className="flex items-center gap-2.5">
              <Activity size={14} className="text-[#9aabb8]" />
              <h2 className="text-[14px] font-semibold text-[#0f1923]">Movimentações</h2>
            </div>
            <span className="text-[11px] text-[#9aabb8] bg-[#F3F1EE] px-2 py-0.5 rounded-md border border-[#E2DDD8]">
              30 dias
            </span>
          </div>
          <div className="px-6 py-5 space-y-3">
            <div className="flex items-center justify-between px-4 py-4 bg-[#E8F2F2] rounded-xl">
              <div>
                <p className="text-[13px] font-semibold text-[#1D5F60]">Com movimentação</p>
                <p className="text-[11px] text-[#7a9a9a] mt-0.5">Últimos 30 dias</p>
              </div>
              <span className="text-[32px] font-black text-[#1D5F60] leading-none">{processosComMovimentacao}</span>
            </div>

            <div className="flex items-center justify-between px-4 py-4 bg-rose-50 rounded-xl border border-rose-100">
              <div>
                <p className="text-[13px] font-semibold text-rose-800">Sem movimentação</p>
                <p className="text-[11px] text-rose-400 mt-0.5">Nenhuma atividade recente</p>
              </div>
              <span className="text-[32px] font-black text-rose-700 leading-none">{processosSemMovimentacao}</span>
            </div>

            <div className="pt-1">
              <div className="flex justify-between text-[11px] text-[#9aabb8] mb-2">
                <span>Processos movimentados</span>
                <span className="font-semibold text-[#4a5a6a]">{movPct}%</span>
              </div>
              <div className="h-2 bg-[#F3F1EE] rounded-full overflow-hidden border border-[#E2DDD8]">
                <div
                  className="h-full bg-[#145A5B] rounded-full transition-all duration-700"
                  style={{ width: `${movPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Produtividade por colaborador (sócio only) ───────────────────────── */}
      {userRole === 'socio' && <ProdutividadeColaboradores />}

      {/* ── Row 4: Últimos registros ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-5">

        {/* Últimos Processos */}
        <div className={card}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F4F4]">
            <div className="flex items-center gap-2.5">
              <Scale size={14} className="text-[#9aabb8]" />
              <h2 className="text-[14px] font-semibold text-[#0f1923]">Últimos Processos</h2>
            </div>
            <Link href="/processos" className="text-[11px] text-[#b8903a] font-semibold hover:text-[#a07830] transition-colors">
              Ver todos →
            </Link>
          </div>
          {!ultimosProcessos || ultimosProcessos.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-[13px] text-[#9aabb8]">Nenhum processo cadastrado</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F7F9F9]">
              {ultimosProcessos.map((processo: any) => (
                <Link
                  key={processo.id}
                  href={`/processos/${processo.id}`}
                  className="flex items-center gap-3.5 px-6 py-4 hover:bg-[#FAFBFB] transition-colors group"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#ede9f8] flex items-center justify-center flex-shrink-0">
                    <Scale size={15} className="text-[#5b3fa6]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#0f1923] truncate group-hover:text-[#1D5F60] transition-colors">
                      {processo.titulo}
                    </p>
                    <p className="text-[11px] text-[#9aabb8] mt-0.5 truncate">
                      {processo.cliente?.nome ?? '—'} · {areaLabel[processo.area_direito] ?? processo.area_direito}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusBadge[processo.status] ?? 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                    {statusLabel[processo.status] ?? processo.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Últimos Clientes */}
        <div className={card}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F4F4]">
            <div className="flex items-center gap-2.5">
              <Users size={14} className="text-[#9aabb8]" />
              <h2 className="text-[14px] font-semibold text-[#0f1923]">Últimos Clientes</h2>
            </div>
            <Link href="/clientes" className="text-[11px] text-[#b8903a] font-semibold hover:text-[#a07830] transition-colors">
              Ver todos →
            </Link>
          </div>
          {!ultimosClientes || ultimosClientes.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-[13px] text-[#9aabb8]">Nenhum cliente cadastrado</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F7F9F9]">
              {ultimosClientes.map((cliente: any) => (
                <Link
                  key={cliente.id}
                  href={`/clientes/${cliente.id}`}
                  className="flex items-center gap-3.5 px-6 py-4 hover:bg-[#FAFBFB] transition-colors group"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#E8F0F0] to-[#D0DCDC] flex items-center justify-center flex-shrink-0">
                    <span className="text-[13px] font-bold text-[#1D5F60]">
                      {cliente.nome.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#0f1923] truncate group-hover:text-[#1D5F60] transition-colors">
                      {cliente.nome}
                    </p>
                    {(cliente.cidade || cliente.uf) && (
                      <p className="text-[11px] text-[#9aabb8] mt-0.5">
                        {[cliente.cidade, cliente.uf].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <ArrowUpRight size={14} className="text-[#D0DCDC] group-hover:text-[#9aabb8] transition-colors flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
