'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PainelDiario, PainelItem, StatusNorm, UrgenciaNorm, TipoItem } from '@/app/api/tv/painel-diario/route'

// ── Constantes ────────────────────────────────────────────────────────────────

const POLL_MS = 30_000   // atualiza dados a cada 30s

// Paleta P&V
const GOLD    = '#C49557'
const GOLD_DK = '#A07840'

// ── Helpers visuais ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<StatusNorm, {
  dot: string; text: string; bg: string; strikethrough: boolean; badge?: string
}> = {
  pendente:    { dot: 'bg-[#6B7280]',  text: 'text-[#E8E3D8]',  bg: '',                       strikethrough: false },
  em_andamento:{ dot: `bg-[${GOLD}]`,  text: `text-[${GOLD}]`,  bg: `bg-[${GOLD}]/5`,          strikethrough: false, badge: 'Em andamento' },
  concluido:   { dot: 'bg-emerald-400',text: 'text-[#6B7280]',   bg: 'bg-emerald-950/20',      strikethrough: true,  badge: 'Concluído' },
  atrasado:    { dot: 'bg-red-500',     text: 'text-red-300',     bg: 'bg-red-950/30',           strikethrough: false, badge: 'Atrasado' },
  cancelado:   { dot: 'bg-[#374151]',  text: 'text-[#4B5563]',  bg: 'bg-[#1F2937]/20',        strikethrough: true,  badge: 'Cancelado' },
  reagendado:  { dot: 'bg-[#94A3B8]',  text: 'text-[#64748B]',  bg: 'bg-[#1E293B]/30',        strikethrough: true,  badge: 'Reagendado' },
}

const URGENCIA_DOT: Record<UrgenciaNorm, string> = {
  critico:  'bg-red-500 animate-pulse',
  atencao:  `bg-[${GOLD}]`,
  normal:   'bg-[#374151]',
  concluido:'bg-emerald-500',
}

const TIPO_LABEL: Record<TipoItem, string> = {
  audiencia:  'Audiência',
  prazo:      'Prazo',
  tarefa:     'Tarefa',
  publicacao: 'Publicação',
  reuniao:    'Reunião',
  diligencia: 'Diligência',
  outro:      'Evento',
}

const AREA_SHORT: Record<string, string> = {
  civil:          'Cível',
  trabalhista:    'Trab.',
  criminal:       'Crim.',
  tributario:     'Trib.',
  previdenciario: 'Prev.',
  administrativo: 'Adm.',
  familia:        'Fam.',
  empresarial:    'Emp.',
  outro:          'Outro',
}

// ── Clock em tempo real ───────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState<string>('')

  useEffect(() => {
    const tick = () => {
      setTime(
        new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: false,
        }).format(new Date())
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="font-mono tabular-nums tracking-wide" style={{ color: GOLD }}>
      {time}
    </span>
  )
}

// ── Item de painel ────────────────────────────────────────────────────────────

function PainelItemRow({ item, compact = false }: { item: PainelItem; compact?: boolean }) {
  const st = STATUS_STYLES[item.status]

  return (
    <div className={[
      'flex items-start gap-3 py-2.5 border-b border-white/[0.04] last:border-0',
      st.bg ? `rounded-lg px-2 ${st.bg}` : '',
    ].join(' ')}>

      {/* Urgência dot */}
      <span className={[
        'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
        URGENCIA_DOT[item.urgencia],
      ].join(' ')} />

      {/* Horário */}
      {item.horario && (
        <span className="text-[13px] font-mono font-semibold w-10 flex-shrink-0 mt-0.5"
              style={{ color: GOLD }}>
          {item.horario}
        </span>
      )}

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className={[
            'text-[13px] font-medium leading-snug flex-1 min-w-0',
            st.text,
            st.strikethrough ? 'line-through opacity-60' : '',
          ].join(' ')}>
            {item.titulo}
          </span>

          {/* Badge de status */}
          {st.badge && (
            <span className={[
              'text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded flex-shrink-0',
              item.status === 'concluido' ? 'bg-emerald-900/50 text-emerald-400' :
              item.status === 'atrasado'  ? 'bg-red-900/50 text-red-400' :
              item.status === 'em_andamento' ? `text-[${GOLD}] border border-[${GOLD}]/30` :
              'bg-white/5 text-white/40',
            ].join(' ')}>
              {st.badge}
            </span>
          )}
        </div>

        {!compact && (
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {/* Tipo */}
            <span className="text-[10px] text-white/25 uppercase tracking-wider">
              {TIPO_LABEL[item.tipo]}
            </span>

            {/* Processo */}
            {item.processo_num && (
              <>
                <span className="text-white/15">·</span>
                <span className="text-[10px] text-white/30 font-mono">
                  {item.processo_num}
                </span>
              </>
            )}

            {/* Área */}
            {item.area && (
              <>
                <span className="text-white/15">·</span>
                <span className="text-[10px] text-white/25">
                  {AREA_SHORT[item.area] ?? item.area}
                </span>
              </>
            )}

            {/* Responsável */}
            {item.responsavel && (
              <>
                <span className="text-white/15">·</span>
                <span className="text-[10px] text-white/40 font-medium">
                  {item.responsavel}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Bloco de seção ────────────────────────────────────────────────────────────

function Bloco({
  titulo, items, emptyMsg, maxItems = 6, compact = false,
  highlight = false,
}: {
  titulo:     string
  items:      PainelItem[]
  emptyMsg:   string
  maxItems?:  number
  compact?:   boolean
  highlight?: boolean
}) {
  const visible = items.slice(0, maxItems)

  return (
    <div className={[
      'flex flex-col rounded-xl border overflow-hidden',
      highlight
        ? `border-[${GOLD}]/20 bg-[${GOLD}]/[0.03]`
        : 'border-white/[0.06] bg-white/[0.02]',
    ].join(' ')}>

      {/* Cabeçalho da seção */}
      <div className={[
        'flex items-center justify-between px-4 py-2.5 border-b',
        highlight ? `border-[${GOLD}]/15` : 'border-white/[0.05]',
      ].join(' ')}>
        <span className="text-[10px] font-bold tracking-[0.15em] uppercase"
              style={{ color: highlight ? GOLD : 'rgba(245,240,232,0.4)' }}>
          {titulo}
        </span>
        {items.length > 0 && (
          <span className="text-[10px] font-bold tabular-nums"
                style={{ color: highlight ? GOLD : 'rgba(245,240,232,0.25)' }}>
            {items.length}
          </span>
        )}
      </div>

      {/* Itens */}
      <div className="flex-1 px-3 py-1 overflow-hidden">
        {visible.length === 0 ? (
          <p className="text-[11px] text-white/15 italic text-center py-4">{emptyMsg}</p>
        ) : (
          visible.map(item => (
            <PainelItemRow key={item.id} item={item} compact={compact} />
          ))
        )}
        {items.length > maxItems && (
          <p className="text-[10px] text-white/20 text-right py-1">
            +{items.length - maxItems} mais
          </p>
        )}
      </div>
    </div>
  )
}

// ── Indicador de meta ─────────────────────────────────────────────────────────

function MetaBadge({ label, value, alert = false }: {
  label: string; value: number; alert?: boolean
}) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border"
         style={{
           borderColor: alert && value > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)',
           background:  alert && value > 0 ? 'rgba(127,29,29,0.2)' : 'rgba(255,255,255,0.02)',
         }}>
      <span className="text-[18px] font-black tabular-nums leading-none"
            style={{ color: alert && value > 0 ? '#F87171' : GOLD }}>
        {value}
      </span>
      <span className="text-[9px] text-white/30 uppercase tracking-wider leading-tight max-w-[60px]">
        {label}
      </span>
    </div>
  )
}

// ── Skeleton de carregamento ───────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-3">
        {/* Logo P&V animado */}
        <div className="w-14 h-14 rounded-xl flex items-center justify-center"
             style={{ border: `1px solid ${GOLD}30`, background: `${GOLD}08` }}>
          <span className="text-2xl font-serif font-bold animate-pulse"
                style={{ color: GOLD }}>P</span>
        </div>
        <div>
          <p className="text-[11px] text-white/30 text-center tracking-[0.15em] uppercase">
            Pessoa e do Val Advocacia
          </p>
          <p className="text-[11px] text-white/20 text-center mt-1 animate-pulse">
            Carregando painel...
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function PainelTVDiario() {
  const [data,    setData]    = useState<PainelDiario | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/tv/painel-diario', { cache: 'no-store' })
      if (!res.ok) { setError('Erro ao carregar painel.'); return }
      setData(await res.json())
      setError(null)
    } catch {
      setError('Sem conexão com o sistema.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, POLL_MS)
    return () => clearInterval(id)
  }, [fetchData])

  if (loading) return <Skeleton />

  if (error && !data) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  if (!data) return <Skeleton />

  const { blocos, meta, date_br, atualizado_em } = data

  const atempoAtualizacao = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(atualizado_em))

  return (
    <div className="w-full h-full flex flex-col"
         style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center justify-between px-8 py-4"
              style={{ borderBottom: '1px solid rgba(196,149,87,0.12)' }}>

        {/* Logo oficial — versão fundo escuro
            Para trocar: salvar a logo em public/logo-pedv.svg (ou .png c/ transparência)
            e alterar o src abaixo. Altura: 52px. Largura automática (object-contain). */}
        <div className="flex items-center flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Pessoa e do Val Advocacia"
            style={{
              height:      '52px',
              width:       'auto',
              maxWidth:    '200px',
              objectFit:   'contain',
              objectPosition: 'left center',
            }}
          />
        </div>

        {/* Centro — título e data */}
        <div className="text-center">
          <p className="text-[14px] font-semibold text-white/70 tracking-wide uppercase">
            Painel Diário do Escritório
          </p>
          <p className="text-[11px] text-white/30 mt-0.5 capitalize">{date_br}</p>
        </div>

        {/* Relógio e meta */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <MetaBadge label="prazos hoje" value={meta.total_prazos} />
            <MetaBadge label="atrasados"   value={meta.total_atrasado} alert />
            <MetaBadge label="tarefas"     value={meta.total_tarefas} />
          </div>

          <div className="text-right pl-4" style={{ borderLeft: `1px solid ${GOLD}20` }}>
            <div className="text-[28px] font-bold leading-none">
              <LiveClock />
            </div>
            <p className="text-[9px] text-white/20 mt-1 text-right">
              Atualizado {atempoAtualizacao}
            </p>
          </div>
        </div>
      </header>

      {/* Linha dourada decorativa */}
      <div className="h-px flex-shrink-0"
           style={{ background: `linear-gradient(to right, transparent, ${GOLD}40, transparent)` }} />

      {/* ── GRADE PRINCIPAL ────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 grid gap-3 p-4"
           style={{
             gridTemplateColumns: '1.2fr 1fr 1fr',
             gridTemplateRows:    '1fr 1fr 0.8fr',
           }}>

        {/* AGORA — destaque, ocupa 2 linhas */}
        <div style={{ gridRow: '1 / 3' }}>
          <Bloco
            titulo="Agora"
            items={blocos.agora}
            emptyMsg="Nenhum compromisso no próximo período"
            maxItems={8}
            highlight
          />
        </div>

        {/* AUDIÊNCIAS */}
        <Bloco
          titulo="Audiências"
          items={blocos.audiencias}
          emptyMsg="Nenhuma audiência hoje"
          maxItems={4}
        />

        {/* REUNIÕES */}
        <Bloco
          titulo="Reuniões"
          items={blocos.reunioes}
          emptyMsg="Nenhuma reunião hoje"
          maxItems={4}
        />

        {/* PRAZOS DO DIA */}
        <Bloco
          titulo="Prazos do Dia"
          items={blocos.prazos_do_dia}
          emptyMsg="Nenhum prazo vencendo hoje"
          maxItems={4}
        />

        {/* TAREFAS URGENTES */}
        <Bloco
          titulo="Tarefas Urgentes"
          items={blocos.tarefas_urgentes}
          emptyMsg="Nenhuma tarefa crítica ou de alta prioridade"
          maxItems={4}
          compact
        />

        {/* PENDÊNCIAS */}
        <div style={{ gridColumn: '1 / 2' }}>
          <Bloco
            titulo="Pendências"
            items={blocos.pendencias}
            emptyMsg="Sem pendências abertas"
            maxItems={4}
            compact
          />
        </div>

        {/* ATUALIZAÇÕES RECENTES */}
        <div style={{ gridColumn: '2 / 4' }}>
          <Bloco
            titulo="Atualizações Recentes"
            items={blocos.atualizacoes_recentes}
            emptyMsg="Nenhuma movimentação nas últimas 24h"
            maxItems={5}
            compact
          />
        </div>
      </div>

      {/* ── RODAPÉ ─────────────────────────────────────────────────────────── */}
      <footer className="flex-shrink-0 flex items-center justify-between px-8 py-2"
              style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <span className="text-[9px] text-white/15 tracking-wider uppercase">
          Pessoa e do Val Advocacia · Belo Horizonte, MG
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] text-white/15">Painel em tempo real</span>
        </div>
        <span className="text-[9px] text-white/15 tracking-wider uppercase">
          Uso interno · Confidencial
        </span>
      </footer>
    </div>
  )
}
