'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle, Clock, CheckCircle2, Activity,
  Users, TrendingUp, Calendar, Zap, Building2, Timer,
} from 'lucide-react'

// Intervalos de tempo (ms)
const ROTATION_MS   = 25_000   // troca de tela a cada 25s
const REFRESH_MS    = 30_000   // busca novos dados a cada 30s
const TRANSITION_MS = 600      // duracao do fade entre telas
const SCREEN_COUNT  = 4

// ── Tipos ──────────────────────────────────────────────────────────────────────

type UserRank = { nome: string; count: number }

type TVSnapshot = {
  tasks: {
    total_open: number
    overdue: number
    due_today: number
    fazendo: number
    com_pendencia: number
    completed_week: number
    created_today: number
  }
  rankings: {
    top_atrasados: UserRank[]
    top_produtividade: UserRank[]
    sobrecarregados: UserRank[]
  }
  agenda_hoje: { titulo: string; hora: string | null; tipo: string }[]
  processos: { ativos: number; com_movimentacao: number; sem_movimentacao: number }
  updated_at: string
}

// Timesheet: tabela nao existe ainda — mock para expansao futura
const TIMESHEET_MOCK = {
  horas_hoje: 24,
  horas_semana: 112,
  sem_lancamento: [{ nome: 'Sidiney' }, { nome: 'Debora' }],
  ranking: [
    { nome: 'Taina', count: 8 },
    { nome: 'Marcelo', count: 7 },
    { nome: 'Luana', count: 6 },
    { nome: 'Rafael', count: 5 },
  ],
}

const SCREEN_TITLES = ['Status Critico', 'Produtividade', 'Movimento do Escritorio', 'Timesheet']

const AGENDA_LABEL: Record<string, string> = {
  audiencia: 'Audiencia', prazo_processual: 'Prazo',
  reuniao: 'Reuniao', diligencia: 'Diligencia', evento: 'Evento', outro: 'Outro',
}

function fmtAtualizado(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ── Cabecalho ──────────────────────────────────────────────────────────────────

function TVHeader({ activeScreen, lastUpdated }: { activeScreen: number; lastUpdated: string }) {
  const [hora, setHora] = useState(() => new Date().toLocaleTimeString('pt-BR'))
  useEffect(() => {
    const id = setInterval(() => setHora(new Date().toLocaleTimeString('pt-BR')), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="flex items-center justify-between px-10 py-5 border-b border-white/[0.06] flex-shrink-0">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#0F3D3E] flex items-center justify-center">
          <Building2 size={20} className="text-[#d4a94e]" />
        </div>
        <div>
          <p className="text-xl font-bold tracking-tight text-white leading-none">Painel do Escritorio</p>
          <p className="text-xs text-white/40 mt-0.5 font-medium tracking-widest uppercase">
            {SCREEN_TITLES[activeScreen]}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-3xl font-mono font-bold text-white/90 tabular-nums leading-none">{hora}</p>
        <p className="text-[11px] text-white/30 mt-1 font-medium">
          Atualizado {lastUpdated ? fmtAtualizado(lastUpdated) : '--:--:--'}
        </p>
      </div>
    </header>
  )
}

// ── Card de metrica ────────────────────────────────────────────────────────────

type CardColor = 'red' | 'amber' | 'blue' | 'green' | 'white' | 'purple'

const CARD_STYLES: Record<CardColor, { bg: string; num: string; icon: string; dot: string }> = {
  red:    { bg: 'bg-red-950/60 border-red-800/40',         num: 'text-red-400',     icon: 'text-red-500',     dot: 'bg-red-500'     },
  amber:  { bg: 'bg-amber-950/60 border-amber-800/40',     num: 'text-amber-400',   icon: 'text-amber-500',   dot: 'bg-amber-500'   },
  blue:   { bg: 'bg-blue-950/60 border-blue-800/40',       num: 'text-blue-400',    icon: 'text-blue-500',    dot: 'bg-blue-500'    },
  green:  { bg: 'bg-emerald-950/60 border-emerald-800/40', num: 'text-emerald-400', icon: 'text-emerald-500', dot: 'bg-emerald-500' },
  white:  { bg: 'bg-white/[0.05] border-white/[0.08]',     num: 'text-white',       icon: 'text-white/50',    dot: 'bg-white/50'    },
  purple: { bg: 'bg-purple-950/60 border-purple-800/40',   num: 'text-purple-400',  icon: 'text-purple-500',  dot: 'bg-purple-500'  },
}

function MetricCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string; value: number | string; icon: React.ElementType; color: CardColor; sub?: string
}) {
  const s = CARD_STYLES[color]
  return (
    <div className={['rounded-2xl border p-7 flex flex-col justify-between', s.bg].join(' ')}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-white/[0.07] flex items-center justify-center">
          <Icon size={22} className={s.icon} />
        </div>
        <div className={['w-2 h-2 rounded-full mt-2', s.dot].join(' ')} />
      </div>
      <div>
        <p className={['text-7xl font-black leading-none tabular-nums tracking-tight', s.num].join(' ')}>
          {value}
        </p>
        <p className="text-base font-semibold text-white/60 mt-3 leading-tight">{label}</p>
        {sub && <p className="text-xs text-white/30 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ── Lista de ranking ───────────────────────────────────────────────────────────

type RankColor = 'blue' | 'red' | 'green' | 'amber' | 'purple'

const BAR_COLOR: Record<RankColor, string> = {
  blue: 'bg-blue-500', red: 'bg-red-500', green: 'bg-emerald-500',
  amber: 'bg-amber-500', purple: 'bg-purple-500',
}

function RankingList({
  title, icon: Icon, items, emptyMsg = 'Nenhum dado', suffix = 'tarefas', color = 'blue',
}: {
  title: string; icon: React.ElementType; items: UserRank[]
  emptyMsg?: string; suffix?: string; color?: RankColor
}) {
  const max = items[0]?.count ?? 1
  return (
    <div className="bg-white/[0.04] rounded-2xl border border-white/[0.06] p-6 flex flex-col h-full">
      <div className="flex items-center gap-2.5 mb-5">
        <Icon size={17} className="text-white/40" />
        <h3 className="text-sm font-bold text-white/70 uppercase tracking-widest">{title}</h3>
      </div>
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-white/25 italic">{emptyMsg}</p>
        </div>
      ) : (
        <div className="space-y-4 flex-1">
          {items.map((item, i) => {
            const pct = Math.round((item.count / max) * 100)
            return (
              <div key={item.nome + i}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-white/25 w-4 tabular-nums">{i + 1}</span>
                    <span className="text-sm font-semibold text-white/85 truncate max-w-[160px]">{item.nome}</span>
                  </div>
                  <span className="text-sm font-bold text-white/70 tabular-nums ml-2">
                    {item.count}{' '}<span className="text-xs font-normal text-white/30">{suffix}</span>
                  </span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className={['h-full rounded-full transition-all duration-700', BAR_COLOR[color]].join(' ')}
                    style={{ width: pct + '%' }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Dots indicadores de tela ───────────────────────────────────────────────────

function TVScreenDots({ active, total }: { active: number; total: number }) {
  return (
    <div className="flex items-center gap-2.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={[
            'rounded-full transition-all duration-500',
            i === active ? 'w-6 h-2 bg-[#d4a94e]' : 'w-2 h-2 bg-white/20',
          ].join(' ')}
        />
      ))}
      <span className="text-xs text-white/25 ml-1 font-medium tabular-nums">
        {active + 1}/{total}
      </span>
    </div>
  )
}

// ── Tela 1: Status Critico ─────────────────────────────────────────────────────

function TVScreenCritical({ data }: { data: TVSnapshot }) {
  const { tasks, rankings, agenda_hoje } = data
  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="grid grid-cols-4 gap-5">
        <MetricCard label="Atrasadas"       value={tasks.overdue}       icon={AlertTriangle} color="red"    sub="Prazo vencido" />
        <MetricCard label="Vencem Hoje"     value={tasks.due_today}     icon={Clock}         color="amber"  sub="Requerem atencao" />
        <MetricCard label="Com Pendencia"   value={tasks.com_pendencia} icon={Zap}           color="purple" sub="Aguardando resolucao" />
        <MetricCard label="Total em Aberto" value={tasks.total_open}    icon={Activity}      color="white"  sub="Todas as etapas" />
      </div>
      <div className="grid grid-cols-2 gap-5 flex-1 min-h-0">
        <div className="bg-white/[0.04] rounded-2xl border border-white/[0.06] p-6 flex flex-col">
          <div className="flex items-center gap-2.5 mb-5">
            <Calendar size={17} className="text-white/40" />
            <h3 className="text-sm font-bold text-white/70 uppercase tracking-widest">Agenda de Hoje</h3>
          </div>
          {agenda_hoje.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-white/25 italic">Nenhum compromisso hoje</p>
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-hidden">
              {agenda_hoje.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
                  {item.hora && (
                    <span className="text-sm font-mono font-bold text-amber-400 w-14 flex-shrink-0">
                      {item.hora.slice(0, 5)}
                    </span>
                  )}
                  <p className="flex-1 text-sm font-medium text-white/80 truncate">{item.titulo}</p>
                  <span className="text-xs text-white/30 flex-shrink-0">
                    {AGENDA_LABEL[item.tipo] ?? item.tipo}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <RankingList title="Top Atrasos" icon={AlertTriangle} items={rankings.top_atrasados} emptyMsg="Nenhum atraso registrado" color="red" />
      </div>
    </div>
  )
}

// ── Tela 2: Produtividade ──────────────────────────────────────────────────────

function TVScreenProductivity({ data }: { data: TVSnapshot }) {
  const { tasks, rankings } = data
  const aFazer = Math.max(0, tasks.total_open - tasks.fazendo - tasks.com_pendencia)
  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="grid grid-cols-4 gap-5">
        <MetricCard label="Concluidas na Semana" value={tasks.completed_week} icon={CheckCircle2} color="green"  sub="Esta semana" />
        <MetricCard label="Em Andamento"         value={tasks.fazendo}       icon={Activity}     color="blue"   sub="Status: fazendo" />
        <MetricCard label="A Fazer"              value={aFazer}              icon={Clock}        color="white"  sub="Backlog + A Fazer" />
        <MetricCard label="Criadas Hoje"         value={tasks.created_today} icon={Zap}          color="purple" sub="Novas tarefas" />
      </div>
      <div className="grid grid-cols-2 gap-5 flex-1 min-h-0">
        <RankingList title="Ranking de Produtividade" icon={TrendingUp} items={rankings.top_produtividade} emptyMsg="Nenhuma tarefa concluida esta semana" color="green" />
        <RankingList title="Mais Sobrecarregados"     icon={Users}      items={rankings.sobrecarregados}   emptyMsg="Nenhuma tarefa em aberto"           color="amber" />
      </div>
    </div>
  )
}

// ── Tela 3: Movimento do Escritorio ───────────────────────────────────────────

function TVScreenMovement({ data }: { data: TVSnapshot }) {
  const { tasks, processos, rankings } = data
  const movPct = processos.ativos > 0
    ? Math.round((processos.com_movimentacao / processos.ativos) * 100)
    : 0
  const aFazer = Math.max(0, tasks.total_open - tasks.fazendo - tasks.com_pendencia)
  const distRows = [
    { label: 'Em Andamento',  value: tasks.fazendo,       color: 'bg-blue-500'   },
    { label: 'A Fazer',       value: aFazer,              color: 'bg-slate-500'  },
    { label: 'Com Pendencia', value: tasks.com_pendencia, color: 'bg-purple-500' },
    { label: 'Atrasadas',     value: tasks.overdue,       color: 'bg-red-500'    },
  ]
  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="grid grid-cols-4 gap-5">
        <MetricCard label="Processos Ativos"     value={processos.ativos}           icon={Building2}     color="white" sub="Status: ativo" />
        <MetricCard label="Com Movimentacao"     value={processos.com_movimentacao} icon={Activity}      color="green" sub="Ultimos 30 dias" />
        <MetricCard label="Sem Movimentacao"     value={processos.sem_movimentacao} icon={AlertTriangle} color="red"   sub="Sem atividade recente" />
        <MetricCard label="Tarefas Criadas Hoje" value={tasks.created_today}        icon={Zap}           color="blue"  sub="Novas no kanban" />
      </div>
      <div className="grid grid-cols-2 gap-5 flex-1 min-h-0">
        <div className="bg-white/[0.04] rounded-2xl border border-white/[0.06] p-6 flex flex-col">
          <div className="flex items-center gap-2.5 mb-5">
            <Activity size={17} className="text-white/40" />
            <h3 className="text-sm font-bold text-white/70 uppercase tracking-widest">Distribuicao de Tarefas</h3>
          </div>
          <div className="space-y-4 flex-1">
            {distRows.map(row => (
              <div key={row.label}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-white/60">{row.label}</span>
                  <span className="text-sm font-bold text-white/80 tabular-nums">{row.value}</span>
                </div>
                <div className="h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className={['h-full rounded-full transition-all duration-700', row.color].join(' ')}
                    style={{ width: (tasks.total_open > 0 ? Math.round((row.value / tasks.total_open) * 100) : 0) + '%' }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-5 border-t border-white/[0.06]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-white/40">Processos movimentados</span>
              <span className="text-sm font-bold text-white/70">{movPct}%</span>
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: movPct + '%' }} />
            </div>
          </div>
        </div>
        <RankingList title="Mais Sobrecarregados" icon={Users} items={rankings.sobrecarregados} emptyMsg="Carga distribuida uniformemente" color="amber" />
      </div>
    </div>
  )
}

// ── Tela 4: Timesheet (mock — tabela nao existe ainda) ─────────────────────────

function TVScreenTimesheet({ data }: { data: TVSnapshot }) {
  const ts = TIMESHEET_MOCK
  const totalColabs = data.rankings.sobrecarregados.length + ts.sem_lancamento.length
  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="grid grid-cols-4 gap-5">
        <MetricCard label="Horas Hoje"           value={ts.horas_hoje + 'h'}    icon={Timer}         color="blue"  sub="Total lancado" />
        <MetricCard label="Horas na Semana"      value={ts.horas_semana + 'h'}  icon={TrendingUp}    color="green" sub="Semana atual" />
        <MetricCard label="Sem Lancamento Hoje"  value={ts.sem_lancamento.length} icon={AlertTriangle} color="red" sub="Precisam lancar" />
        <MetricCard label="Colaboradores Ativos" value={totalColabs}            icon={Users}         color="white" sub="Com tarefas abertas" />
      </div>
      <div className="grid grid-cols-2 gap-5 flex-1 min-h-0">
        <RankingList title="Ranking de Horas" icon={Timer} items={ts.ranking} emptyMsg="Nenhum lancamento esta semana" suffix="horas" color="green" />
        <div className="bg-white/[0.04] rounded-2xl border border-white/[0.06] p-6 flex flex-col">
          <div className="flex items-center gap-2.5 mb-5">
            <AlertTriangle size={17} className="text-red-400/70" />
            <h3 className="text-sm font-bold text-white/70 uppercase tracking-widest">Sem Lancamento Hoje</h3>
          </div>
          {ts.sem_lancamento.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-emerald-400">Todos lancaram hoje</p>
            </div>
          ) : (
            <div className="space-y-3 flex-1">
              {ts.sem_lancamento.map((u, i) => (
                <div key={i} className="flex items-center gap-3 py-3 border-b border-white/[0.05] last:border-0">
                  <div className="w-9 h-9 rounded-full bg-red-900/40 border border-red-700/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-red-400">{u.nome[0]}</span>
                  </div>
                  <span className="text-sm font-medium text-white/70">{u.nome}</span>
                  <span className="ml-auto text-xs font-medium text-red-400 bg-red-950/60 px-2 py-1 rounded-md">Pendente</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-white/15 mt-4 text-center italic">Dados de timesheet em implementacao</p>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function TVDashboard() {
  const [activeScreen, setActiveScreen] = useState(0)
  const [visible, setVisible] = useState(true)
  const [data, setData] = useState<TVSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/tv/snapshot')
      if (!res.ok) return
      setData(await res.json())
    } catch { /* falha silenciosa — manter dados anteriores */ } finally {
      setLoading(false)
    }
  }, [])

  // Carga inicial + polling a cada 30s
  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchData])

  // Rotacao automatica: fade-out -> troca tela -> fade-in a cada 25s
  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setActiveScreen(s => (s + 1) % SCREEN_COUNT)
        setVisible(true)
      }, TRANSITION_MS / 2)
    }, ROTATION_MS)
    return () => clearInterval(id)
  }, [])

  if (loading || !data) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.06] flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Building2 size={28} className="text-[#d4a94e]" />
          </div>
          <p className="text-white/40 text-sm font-medium">Carregando painel...</p>
        </div>
      </div>
    )
  }

  const screens = [
    <TVScreenCritical     key="c" data={data} />,
    <TVScreenProductivity key="p" data={data} />,
    <TVScreenMovement     key="m" data={data} />,
    <TVScreenTimesheet    key="t" data={data} />,
  ]

  const halfMs = TRANSITION_MS / 2

  return (
    <div className="flex flex-col h-full">
      <TVHeader activeScreen={activeScreen} lastUpdated={data.updated_at} />

      {/* Conteudo com transicao fade suave entre telas */}
      <main
        className="flex-1 px-10 py-6 min-h-0"
        style={{
          opacity:    visible ? 1 : 0,
          transform:  visible ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity ' + halfMs + 'ms ease, transform ' + halfMs + 'ms ease',
        }}
      >
        {screens[activeScreen]}
      </main>

      <footer className="flex items-center justify-between px-10 pb-5 flex-shrink-0">
        <TVScreenDots active={activeScreen} total={SCREEN_COUNT} />
        <p className="text-[11px] text-white/20 font-medium">
          Proxima: {SCREEN_TITLES[(activeScreen + 1) % SCREEN_COUNT]} em {ROTATION_MS / 1000}s
        </p>
      </footer>
    </div>
  )
}
