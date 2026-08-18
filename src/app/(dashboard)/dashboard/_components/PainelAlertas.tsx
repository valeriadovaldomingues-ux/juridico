import Link from 'next/link'
import { Bell, Gavel, CalendarHeart, ListChecks, DollarSign, PartyPopper } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AniversarianteResumo {
  id: string
  nome: string
}

export interface AlertasResumo {
  prazosHoje: number
  prazos7Dias: number
  audienciasHoje: number
  audiencias7Dias: number
  aniversariosHoje: AniversarianteResumo[]
  aniversarios7Dias: AniversarianteResumo[]
  tarefas: {
    critico: number   // ação imediata
    atencao: number   // ação esperada em breve
    normal: number
    semSla: number     // sem urgência calculada (maioria do backlog hoje)
  }
  financeiro: { aReceberHoje: number; vencidoTotal: number } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function AlertLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#FAFBFB]">
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-copper)] flex-shrink-0" />
      <p className="text-[12.5px] text-[#4a5a6a] leading-snug">{children}</p>
    </div>
  )
}

function Contador({ label, value, href, tone }: { label: string; value: number; href: string; tone: 'rose' | 'amber' | 'slate' }) {
  const toneCfg = {
    rose:  'text-rose-700 bg-rose-50 border-rose-100',
    amber: 'text-amber-700 bg-amber-50 border-amber-100',
    slate: 'text-[#4a5a6a] bg-[#F3F1EE] border-[#E2DDD8]',
  }[tone]

  if (value === 0) return null

  return (
    <Link href={href} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] font-semibold hover:-translate-y-0.5 transition-transform ${toneCfg}`}>
      <span className="text-[15px] font-black leading-none">{value}</span>
      {label}
    </Link>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PainelAlertas({ alertas }: { alertas: AlertasResumo }) {
  const { prazosHoje, prazos7Dias, audienciasHoje, audiencias7Dias, aniversariosHoje, aniversarios7Dias, tarefas, financeiro } = alertas

  const nadaHoje = prazosHoje === 0 && audienciasHoje === 0 && aniversariosHoje.length === 0
  const nada7Dias = prazos7Dias === 0 && audiencias7Dias === 0 && aniversarios7Dias.length === 0
  const totalUrgente = tarefas.critico + tarefas.atencao

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-[0_12px_36px_rgba(13,34,53,0.05)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-[#F0F4F4]">
        <Bell size={14} className="text-[var(--color-copper)]" />
        <h2 className="text-[14px] font-semibold text-[#0f1923]">Painel de Alertas</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#F0F4F4]">

        {/* ── Hoje / próximos 7 dias ── */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-widest mb-2.5">Hoje</p>
            {nadaHoje ? (
              <p className="text-[12.5px] text-[#9aabb8]">Nada previsto para hoje.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Contador label={prazosHoje === 1 ? 'prazo hoje' : 'prazos hoje'} value={prazosHoje} href="/agenda" tone="rose" />
                <Contador label={audienciasHoje === 1 ? 'audiência hoje' : 'audiências hoje'} value={audienciasHoje} href="/agenda" tone="rose" />
                {aniversariosHoje.length > 0 && (
                  <Link href="/clientes" className="flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] font-semibold text-emerald-700 bg-emerald-50 border-emerald-100 hover:-translate-y-0.5 transition-transform">
                    <PartyPopper size={13} /> {aniversariosHoje.length} aniversário{aniversariosHoje.length > 1 ? 's' : ''} hoje
                  </Link>
                )}
              </div>
            )}
          </div>

          <div>
            <p className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-widest mb-2.5">Próximos 7 dias</p>
            {nada7Dias ? (
              <p className="text-[12.5px] text-[#9aabb8]">Nada previsto para os próximos 7 dias.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Contador label={prazos7Dias === 1 ? 'prazo' : 'prazos'} value={prazos7Dias} href="/agenda" tone="amber" />
                <Contador label={audiencias7Dias === 1 ? 'audiência' : 'audiências'} value={audiencias7Dias} href="/agenda" tone="amber" />
                {aniversarios7Dias.length > 0 && (
                  <Link href="/clientes" className="flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] font-semibold text-[#4a5a6a] bg-[#F3F1EE] border-[#E2DDD8] hover:-translate-y-0.5 transition-transform">
                    <CalendarHeart size={13} /> {aniversarios7Dias.length} aniversário{aniversarios7Dias.length > 1 ? 's' : ''}
                  </Link>
                )}
              </div>
            )}
          </div>

          {financeiro && (financeiro.aReceberHoje > 0 || financeiro.vencidoTotal > 0) && (
            <div className="pt-1 space-y-1.5">
              <p className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-widest mb-1">Financeiro</p>
              {financeiro.aReceberHoje > 0 && (
                <AlertLine>
                  <DollarSign size={11} className="inline text-blue-500 -mt-0.5 mr-1" />
                  A receber hoje: <strong className="text-[#0f1923]">{formatCurrency(financeiro.aReceberHoje)}</strong>
                </AlertLine>
              )}
              {financeiro.vencidoTotal > 0 && (
                <AlertLine>
                  <DollarSign size={11} className="inline text-rose-500 -mt-0.5 mr-1" />
                  Vencido em aberto: <strong className="text-rose-700">{formatCurrency(financeiro.vencidoTotal)}</strong>
                </AlertLine>
              )}
            </div>
          )}
        </div>

        {/* ── Tarefas por urgência ── */}
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold text-[#9aabb8] uppercase tracking-widest flex items-center gap-1.5">
              <ListChecks size={12} /> Tarefas em aberto
            </p>
            <Link href="/kanban" className="text-[11px] text-[var(--color-copper)] font-semibold hover:opacity-80">
              Ver kanban →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-rose-50 border border-rose-100 px-3.5 py-3">
              <p className="text-[22px] font-black text-rose-700 leading-none">{tarefas.critico}</p>
              <p className="text-[10.5px] text-rose-500 mt-1.5 font-medium">Ação imediata</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-3">
              <p className="text-[22px] font-black text-amber-700 leading-none">{tarefas.atencao}</p>
              <p className="text-[10.5px] text-amber-600 mt-1.5 font-medium">Ação em breve</p>
            </div>
            <div className="rounded-xl bg-[#F3F1EE] border border-[#E2DDD8] px-3.5 py-3">
              <p className="text-[22px] font-black text-[#4a5a6a] leading-none">{tarefas.normal}</p>
              <p className="text-[10.5px] text-[#9aabb8] mt-1.5 font-medium">Normal</p>
            </div>
            <div className="rounded-xl bg-white border border-[#E2DDD8] px-3.5 py-3">
              <p className="text-[22px] font-black text-[#c8d0d4] leading-none">{tarefas.semSla}</p>
              <p className="text-[10.5px] text-[#9aabb8] mt-1.5 font-medium">Sem prazo definido</p>
            </div>
          </div>
          {totalUrgente > 0 && (
            <p className="text-[11.5px] text-[#7a8899] mt-3 flex items-center gap-1.5">
              <Gavel size={11} className="text-rose-400" />
              {totalUrgente} tarefa{totalUrgente > 1 ? 's' : ''} pedindo atenção agora.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
