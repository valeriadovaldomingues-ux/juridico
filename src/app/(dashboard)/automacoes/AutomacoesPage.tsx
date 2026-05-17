'use client'

import { useState } from 'react'
import {
  Zap, History, MessageSquare, Play, Loader2,
  ToggleLeft, ToggleRight, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, AlertCircle, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Automation, AutomationRun, MessageTemplate } from '@/types/automations'
import { TRIGGER_LABELS, ACTION_LABELS, TRIGGER_CATEGORIES } from '@/types/automations'

type Tab = 'regras' | 'historico' | 'modelos'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRelativo(iso: string | null): string {
  if (!iso) return '—'
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const horas = Math.floor(diff / 3_600_000)
  const dias  = Math.floor(diff / 86_400_000)
  if (mins  < 1)   return 'agora mesmo'
  if (mins  < 60)  return `${mins} min atrás`
  if (horas < 24)  return `${horas}h atrás`
  if (dias  === 1) return 'ontem'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const STATUS_ICON = {
  ok:      <CheckCircle2 size={13} className="text-emerald-500" />,
  skipped: <Clock        size={13} className="text-amber-500"   />,
  error:   <XCircle      size={13} className="text-red-500"     />,
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initialAutomations: Automation[]
  initialTemplates:   MessageTemplate[]
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AutomacoesPage({ initialAutomations, initialTemplates }: Props) {
  const [tab,           setTab]           = useState<Tab>('regras')
  const [automations,   setAutomations]   = useState<Automation[]>(initialAutomations)
  const [runs,          setRuns]          = useState<AutomationRun[]>([])
  const [loadingRuns,   setLoadingRuns]   = useState(false)
  const [running,       setRunning]       = useState(false)
  const [runResult,     setRunResult]     = useState<{ total_created: number; total_errors: number; automations_ran: number } | null>(null)
  const [runErr,        setRunErr]        = useState('')

  // ── Executar motor ────────────────────────────────────────────────────────

  async function handleRunNow() {
    setRunning(true)
    setRunResult(null)
    setRunErr('')
    try {
      const res = await fetch('/api/automations/run', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setRunErr(data.error ?? `Erro ${res.status}`); return }
      setRunResult(data)
    } catch { setRunErr('Erro de conexão') }
    finally { setRunning(false) }
  }

  // ── Toggle ativa/inativa ──────────────────────────────────────────────────

  async function handleToggle(auto: Automation) {
    const next = !auto.is_active
    setAutomations(prev => prev.map(a => a.id === auto.id ? { ...a, is_active: next } : a))
    const res = await fetch(`/api/automations/${auto.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: next }),
    })
    if (!res.ok) {
      // Reverter
      setAutomations(prev => prev.map(a => a.id === auto.id ? { ...a, is_active: auto.is_active } : a))
    }
  }

  // ── Carregar histórico ────────────────────────────────────────────────────

  async function loadRuns() {
    if (runs.length > 0) return
    setLoadingRuns(true)
    try {
      const res = await fetch('/api/automations/runs?limit=50')
      if (res.ok) setRuns(await res.json())
    } finally { setLoadingRuns(false) }
  }

  function handleTabChange(t: Tab) {
    setTab(t)
    if (t === 'historico') loadRuns()
  }

  const activeCount   = automations.filter(a => a.is_active).length
  const inactiveCount = automations.length - activeCount

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#0f1923] flex items-center gap-2">
            <Zap size={20} className="text-[#b8903a]" />
            Automações Inteligentes
          </h1>
          <p className="text-[13px] text-[#7a8899] mt-1">
            Secretária invisível — o sistema trabalha enquanto você foca no que importa.
          </p>
        </div>

        <button
          onClick={handleRunNow}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1D5F60] text-white text-[13px] font-semibold rounded-xl hover:bg-[#145A5B] disabled:opacity-50 transition-colors shadow-sm"
        >
          {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          {running ? 'Executando…' : 'Executar agora'}
        </button>
      </div>

      {/* Resultado da execução */}
      {runResult && (
        <div className="flex items-center gap-4 bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-3 text-[13px]">
          <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
          <span className="text-emerald-700 font-medium">
            Execução concluída — {runResult.automations_ran} regras avaliadas,{' '}
            <strong>{runResult.total_created}</strong> ações criadas
            {runResult.total_errors > 0 && <>, <span className="text-red-600">{runResult.total_errors} erros</span></>}
          </span>
          <button onClick={() => setRunResult(null)} className="ml-auto text-emerald-400 hover:text-emerald-700">✕</button>
        </div>
      )}
      {runErr && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-5 py-3 text-[13px] text-red-700">
          <AlertCircle size={15} /> {runErr}
          <button onClick={() => setRunErr('')} className="ml-auto">✕</button>
        </div>
      )}

      {/* KPIs rápidos */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-[#E2DDD8] p-4 shadow-sm">
          <p className="text-[11px] text-[#9aabb8] font-semibold uppercase tracking-wide mb-1">Regras ativas</p>
          <p className="text-[28px] font-bold text-emerald-600">{activeCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-[#E2DDD8] p-4 shadow-sm">
          <p className="text-[11px] text-[#9aabb8] font-semibold uppercase tracking-wide mb-1">Inativas</p>
          <p className="text-[28px] font-bold text-[#9aabb8]">{inactiveCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-[#E2DDD8] p-4 shadow-sm">
          <p className="text-[11px] text-[#9aabb8] font-semibold uppercase tracking-wide mb-1">Total de regras</p>
          <p className="text-[28px] font-bold text-[#0f1923]">{automations.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm overflow-hidden">
        <div className="flex border-b border-[#F0F4F4]">
          {([
            { v: 'regras',    l: 'Regras ativas',   icon: Zap },
            { v: 'historico', l: 'Histórico',        icon: History },
            { v: 'modelos',   l: 'Modelos de mensagem', icon: MessageSquare },
          ] as { v: Tab; l: string; icon: React.ElementType }[]).map(({ v, l, icon: Icon }) => (
            <button
              key={v}
              onClick={() => handleTabChange(v)}
              className={cn(
                'flex items-center gap-2 px-5 py-3.5 text-[13px] font-medium transition-colors border-b-2',
                tab === v
                  ? 'text-[#0F3D3E] border-[#0F3D3E]'
                  : 'text-[#9aabb8] border-transparent hover:text-[#374151]',
              )}
            >
              <Icon size={14} />
              {l}
            </button>
          ))}
        </div>

        {/* ── Tab: Regras ───────────────────────────────────────────────────── */}
        {tab === 'regras' && (
          <div className="divide-y divide-[#F7F9F9]">
            {Object.entries(TRIGGER_CATEGORIES).map(([cat, types]) => {
              const catAutos = automations.filter(a => types.includes(a.trigger_type as any))
              if (catAutos.length === 0) return null
              return (
                <CategorySection key={cat} label={cat} automations={catAutos} onToggle={handleToggle} />
              )
            })}
            {/* Automações sem categoria */}
            {automations.filter(a => !Object.values(TRIGGER_CATEGORIES).flat().includes(a.trigger_type as any)).map(a => (
              <AutomationRow key={a.id} auto={a} onToggle={handleToggle} />
            ))}
          </div>
        )}

        {/* ── Tab: Histórico ────────────────────────────────────────────────── */}
        {tab === 'historico' && (
          <div>
            {loadingRuns ? (
              <div className="flex items-center justify-center py-12 text-[#9ca3af]">
                <Loader2 size={16} className="animate-spin mr-2" /> Carregando…
              </div>
            ) : runs.length === 0 ? (
              <div className="py-14 text-center">
                <History size={24} className="text-[#D0DCDC] mx-auto mb-2" />
                <p className="text-[13px] text-[#9aabb8]">Nenhuma execução registrada ainda.</p>
                <p className="text-[12px] text-[#c5cdd8] mt-1">Clique em "Executar agora" para iniciar.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-[#F3F1EE] border-b border-[#F0F4F4] text-[#9aabb8] text-[11px] uppercase tracking-wide">
                      <th className="text-left px-5 py-3">Quando</th>
                      <th className="text-left px-5 py-3">Automação</th>
                      <th className="text-left px-5 py-3">Entidade</th>
                      <th className="text-left px-5 py-3">Ação</th>
                      <th className="text-left px-5 py-3">Status</th>
                      <th className="text-left px-5 py-3">Mensagem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map(run => (
                      <tr key={run.id} className="border-b border-[#F9FAFB] hover:bg-[#FAFBFB]">
                        <td className="px-5 py-3 text-[#7a8899] whitespace-nowrap">{fmtRelativo(run.executed_at)}</td>
                        <td className="px-5 py-3 font-medium text-[#0f1923] max-w-[160px] truncate">
                          {run.automation?.name ?? run.rule_type}
                        </td>
                        <td className="px-5 py-3 text-[#7a8899]">{run.entity_type}</td>
                        <td className="px-5 py-3 text-[#7a8899]">{run.action_type}</td>
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-1">
                            {STATUS_ICON[run.status] ?? null}
                            <span className={cn(
                              'capitalize',
                              run.status === 'ok' ? 'text-emerald-600' : run.status === 'error' ? 'text-red-600' : 'text-amber-600',
                            )}>
                              {run.status}
                            </span>
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[#7a8899] max-w-[200px] truncate" title={run.message ?? ''}>
                          {run.message ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Modelos ──────────────────────────────────────────────────── */}
        {tab === 'modelos' && (
          <div className="divide-y divide-[#F7F9F9]">
            {initialTemplates.length === 0 ? (
              <div className="py-12 text-center">
                <MessageSquare size={24} className="text-[#D0DCDC] mx-auto mb-2" />
                <p className="text-[13px] text-[#9aabb8]">Nenhum modelo cadastrado.</p>
              </div>
            ) : initialTemplates.map(t => (
              <TemplateRow key={t.id} template={t} />
            ))}
          </div>
        )}
      </div>

      {/* Aviso sobre agendamento */}
      <div className="bg-[#F3F1EE] rounded-xl border border-[#E2DDD8] px-5 py-3.5 flex items-start gap-3">
        <AlertCircle size={14} className="text-[#b8903a] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[12px] font-semibold text-[#0f1923]">Execução automática</p>
          <p className="text-[11px] text-[#7a8899] mt-0.5">
            Para que as automações rodem sozinhas, configure um agendamento chamando{' '}
            <code className="bg-white px-1 rounded text-[#0F3D3E] font-mono">POST /api/automations/run</code>{' '}
            via Vercel Cron, pg_cron ou similar.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Seção por categoria ──────────────────────────────────────────────────────

function CategorySection({ label, automations, onToggle }: {
  label:       string
  automations: Automation[]
  onToggle:    (a: Automation) => void
}) {
  const [open, setOpen] = useState(true)
  const active = automations.filter(a => a.is_active).length

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 bg-[#FAFBFB] hover:bg-[#F3F1EE] transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={13} className="text-[#9aabb8]" /> : <ChevronRight size={13} className="text-[#9aabb8]" />}
          <span className="text-[12px] font-semibold text-[#4a5a6a] uppercase tracking-wide">{label}</span>
          <span className="text-[10px] text-[#9aabb8] bg-[#F0F4F4] px-1.5 py-0.5 rounded-full">
            {active}/{automations.length} ativas
          </span>
        </div>
      </button>
      {open && automations.map(a => <AutomationRow key={a.id} auto={a} onToggle={onToggle} />)}
    </div>
  )
}

// ─── Linha de automação ───────────────────────────────────────────────────────

function AutomationRow({ auto, onToggle }: { auto: Automation; onToggle: (a: Automation) => void }) {
  const [editing,  setEditing]  = useState(false)
  const [days,     setDays]     = useState<number>(auto.trigger_conditions.days ?? 7)
  const [saving,   setSaving]   = useState(false)

  const hasDays = auto.trigger_conditions.days !== undefined

  async function saveDays() {
    setSaving(true)
    await fetch(`/api/automations/${auto.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger_conditions: { ...auto.trigger_conditions, days } }),
    })
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className={cn(
      'flex items-start gap-4 px-5 py-4 hover:bg-[#FAFBFB] transition-colors',
      !auto.is_active && 'opacity-60',
    )}>
      {/* Toggle */}
      <button
        onClick={() => onToggle(auto)}
        className="flex-shrink-0 mt-0.5"
        title={auto.is_active ? 'Desativar' : 'Ativar'}
      >
        {auto.is_active
          ? <ToggleRight size={22} className="text-emerald-500" />
          : <ToggleLeft  size={22} className="text-[#D0DCDC]"   />
        }
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-[#0f1923]">{auto.name}</span>
          <span className="text-[10px] bg-[#E8F2F2] text-[#1D5F60] px-2 py-0.5 rounded-full font-medium">
            {TRIGGER_LABELS[auto.trigger_type] ?? auto.trigger_type}
          </span>
          <span className="text-[10px] bg-[#F3F1EE] text-[#7a8899] px-2 py-0.5 rounded-full border border-[#E2DDD8]">
            {ACTION_LABELS[auto.action_type] ?? auto.action_type}
          </span>
        </div>

        {auto.description && (
          <p className="text-[12px] text-[#7a8899] mt-0.5">{auto.description}</p>
        )}

        {/* Configuração de dias */}
        {hasDays && (
          <div className="mt-2 flex items-center gap-2">
            {editing ? (
              <>
                <span className="text-[11px] text-[#7a8899]">Após</span>
                <input
                  type="number"
                  value={days}
                  onChange={e => setDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 px-2 py-1 text-[12px] border border-[#e5e7eb] rounded-lg text-center outline-none focus:border-[#1D5F60]"
                  min={1}
                />
                <span className="text-[11px] text-[#7a8899]">dias sem atualização</span>
                <button onClick={saveDays} disabled={saving} className="text-[11px] text-white bg-[#1D5F60] px-2.5 py-1 rounded-lg hover:bg-[#145A5B] disabled:opacity-50">
                  {saving ? '…' : 'Salvar'}
                </button>
                <button onClick={() => setEditing(false)} className="text-[11px] text-[#9aabb8] hover:text-[#374151]">Cancelar</button>
              </>
            ) : (
              <>
                <span className="text-[11px] text-[#9aabb8]">Após <strong className="text-[#374151]">{auto.trigger_conditions.days}</strong> dias</span>
                <button onClick={() => setEditing(true)} className="text-[10px] text-[#1D5F60] hover:underline">Editar</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Última execução */}
      <div className="text-right flex-shrink-0">
        <p className="text-[10px] text-[#9ca3af]">Última execução</p>
        <p className="text-[11px] font-medium text-[#374151]">{fmtRelativo(auto.last_run_at ?? null)}</p>
        {(auto.total_runs ?? 0) > 0 && (
          <p className="text-[10px] text-[#9ca3af] mt-0.5">{auto.total_runs} execuções</p>
        )}
      </div>
    </div>
  )
}

// ─── Linha de modelo ──────────────────────────────────────────────────────────

function TemplateRow({ template }: { template: MessageTemplate }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="px-5 py-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start justify-between gap-3 text-left"
      >
        <div>
          <p className="text-[13px] font-semibold text-[#0f1923]">{template.name}</p>
          <span className="text-[10px] bg-[#F3F1EE] text-[#7a8899] px-2 py-0.5 rounded-full border border-[#E2DDD8] mt-1 inline-block">
            {template.template_type}
          </span>
        </div>
        {open ? <ChevronDown size={14} className="text-[#9aabb8] flex-shrink-0 mt-0.5" /> : <ChevronRight size={14} className="text-[#9aabb8] flex-shrink-0 mt-0.5" />}
      </button>
      {open && (
        <div className="mt-3 bg-[#F3F1EE] rounded-xl px-4 py-3 text-[12px] text-[#374151] border border-[#E2DDD8]">
          <p className="mb-2 text-[10px] font-semibold text-[#9aabb8] uppercase tracking-wide">Mensagem</p>
          <p className="leading-relaxed whitespace-pre-wrap">{template.content}</p>
          <p className="mt-3 text-[10px] text-[#9aabb8]">
            Variáveis: <code className="bg-white px-1 rounded">[nome]</code>{' '}
            <code className="bg-white px-1 rounded">[responsavel]</code>{' '}
            <code className="bg-white px-1 rounded">[processo]</code>{' '}
            <code className="bg-white px-1 rounded">[prazo]</code>{' '}
            <code className="bg-white px-1 rounded">[data]</code>
          </p>
        </div>
      )}
    </div>
  )
}
