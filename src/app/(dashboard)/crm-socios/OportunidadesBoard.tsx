'use client'

import { useMemo, useState } from 'react'
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AlertCircle, CalendarClock, Clock } from 'lucide-react'
import { ETAPAS, ETAPA_LABEL, CRM_SOCIOS_DIAS_PARADA, type EtapaId } from '@/lib/crm-socios/constants'
import {
  acaoVencida, diasSemInteracao, ehEtapaValida, estaParada, totaisPorEtapa,
} from '@/lib/crm-socios/regras'
import { formatarBRL, formatarDataISO } from '@/lib/crm-socios/formato'
import type { CrmOportunidade } from '@/types/crm-socios'
import { ETAPA_PALETA } from './visual'

interface Props {
  oportunidades: CrmOportunidade[]
  hoje: Date
  onMover: (op: CrmOportunidade, etapa: EtapaId) => void
  onAbrir: (op: CrmOportunidade) => void
}

function CartaoOportunidade({
  op, hoje, accent, onAbrir,
}: { op: CrmOportunidade; hoje: Date; accent: string; onAbrir: (op: CrmOportunidade) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: op.id })
  const parada = estaParada(op, hoje)
  const vencida = acaoVencida(op, hoje)
  const dias = diasSemInteracao(op, hoje)
  const respNome = op.responsavel?.nome ?? null

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.25 : 1, borderLeft: `3px solid ${accent}` }}
      {...attributes}
      {...listeners}
      onClick={() => onAbrir(op)}
      className="bg-white rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.07)] hover:shadow-[0_3px_12px_rgba(0,0,0,0.11)] cursor-grab active:cursor-grabbing transition-shadow duration-150 touch-manipulation"
    >
      <div className="px-3 pt-3 pb-2.5">
        <div className="flex items-center justify-between gap-2 mb-1.5 min-h-[18px]">
          {op.area_interesse ? (
            <span className="text-[10px] font-medium text-zinc-500 bg-zinc-50 border border-zinc-100 px-1.5 py-0.5 rounded-md truncate max-w-[130px]">
              {op.area_interesse}
            </span>
          ) : <span />}
          {parada && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0"
              title={`Sem interação há ${dias} dias (limite: ${CRM_SOCIOS_DIAS_PARADA})`}
            >
              <Clock size={9} />
              parada {dias}d
            </span>
          )}
        </div>

        <p className="text-[13px] font-semibold text-zinc-900 leading-snug line-clamp-2">{op.nome}</p>

        {(op.contato_nome || op.contato_telefone || op.contato_email) && (
          <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
            {op.contato_nome || op.contato_telefone || op.contato_email}
          </p>
        )}

        {op.proxima_acao_data && (
          <p
            className={`mt-2 flex items-start gap-1 text-[11px] leading-snug ${vencida ? 'text-red-600 font-semibold' : 'text-zinc-500'}`}
            title={op.proxima_acao ?? undefined}
          >
            {vencida ? <AlertCircle size={11} className="mt-px flex-shrink-0" /> : <CalendarClock size={11} className="mt-px flex-shrink-0" />}
            <span className="line-clamp-2">
              {formatarDataISO(op.proxima_acao_data)}{op.proxima_acao ? ` · ${op.proxima_acao}` : ''}
              {vencida ? ' (vencida)' : ''}
            </span>
          </p>
        )}

        <div className="flex items-center justify-between mt-2.5">
          {op.valor_estimado ? (
            <span className="text-[12px] font-bold" style={{ color: accent }}>
              {formatarBRL(op.valor_estimado, true)}
            </span>
          ) : (
            <span className="text-[11px] text-zinc-300">Sem valor</span>
          )}
          {respNome && (
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-1 ring-white"
              style={{ backgroundColor: op.responsavel?.cor_kanban ?? '#145A5B' }}
              title={respNome}
            >
              {respNome.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Coluna({
  etapa, ops, hoje, onAbrir,
}: { etapa: EtapaId; ops: CrmOportunidade[]; hoje: Date; onAbrir: (op: CrmOportunidade) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa })
  const paleta = ETAPA_PALETA[etapa]
  const terminal = ETAPAS.find(e => e.id === etapa)?.terminal ?? false
  const t = totaisPorEtapa(ops, hoje)[etapa]

  return (
    <div className="flex-shrink-0 w-[256px] flex flex-col">
      <div className="rounded-t-2xl px-4 py-3" style={{ backgroundColor: paleta.headerBg }}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: paleta.text }}>
            {ETAPA_LABEL[etapa]}
          </span>
          <span
            className="text-[11px] font-bold min-w-6 h-6 px-1 rounded-full flex items-center justify-center text-white"
            style={{ backgroundColor: paleta.accent }}
          >
            {t.qtd}
          </span>
        </div>
        <p className="text-[11px] font-semibold mt-1 h-4" style={{ color: paleta.accent }}>
          {t.valor > 0 ? formatarBRL(t.valor, true) : ''}
        </p>
        {!terminal && (t.paradas > 0 || t.vencidas > 0) && (
          <div className="mt-0.5 space-y-0.5">
            {t.paradas > 0 && (
              <p className="text-[10px] text-amber-700 flex items-center gap-0.5">
                <Clock size={9} />
                {t.paradas} {t.paradas === 1 ? 'parada' : 'paradas'} (&gt;{CRM_SOCIOS_DIAS_PARADA}d)
              </p>
            )}
            {t.vencidas > 0 && (
              <p className="text-[10px] text-red-600 flex items-center gap-0.5">
                <AlertCircle size={9} />
                {t.vencidas} {t.vencidas === 1 ? 'ação vencida' : 'ações vencidas'}
              </p>
            )}
          </div>
        )}
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 min-h-[160px] rounded-b-2xl p-2 space-y-2 transition-all duration-150"
        style={{
          backgroundColor: isOver ? `${paleta.accent}10` : paleta.bg,
          boxShadow: isOver ? `inset 0 0 0 2px ${paleta.accent}40` : `inset 0 0 0 1px ${paleta.accent}20`,
        }}
      >
        <SortableContext items={ops.map(o => o.id)} strategy={verticalListSortingStrategy}>
          {ops.map(op => (
            <CartaoOportunidade key={op.id} op={op} hoje={hoje} accent={paleta.accent} onAbrir={onAbrir} />
          ))}
        </SortableContext>
        {ops.length === 0 && (
          <div className="flex items-center justify-center h-20 rounded-xl border-2 border-dashed" style={{ borderColor: `${paleta.accent}30` }}>
            <span className="text-[11px]" style={{ color: `${paleta.accent}90` }}>
              {isOver ? 'Solte aqui' : 'Arraste para cá'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function OportunidadesBoard({ oportunidades, hoje, onMover, onAbrir }: Props) {
  const [ativoId, setAtivoId] = useState<string | null>(null)

  // Mouse: arrasta após 8px. Toque: segura 250ms (para não brigar com a rolagem horizontal do quadro).
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  const porEtapa = useMemo(() => {
    const m = Object.fromEntries(ETAPAS.map(e => [e.id, [] as CrmOportunidade[]])) as Record<EtapaId, CrmOportunidade[]>
    for (const op of oportunidades) m[op.etapa]?.push(op)
    return m
  }, [oportunidades])

  const ativa = ativoId ? oportunidades.find(o => o.id === ativoId) ?? null : null

  function aoComecar({ active }: DragStartEvent) {
    setAtivoId(String(active.id))
  }

  function aoSoltar({ active, over }: DragEndEvent) {
    setAtivoId(null)
    if (!over) return
    // Soltar na área da coluna: over.id é a etapa. Soltar em cima de outro cartão: over.id é o id dele.
    const destino = ehEtapaValida(over.id)
      ? over.id
      : oportunidades.find(o => o.id === over.id)?.etapa
    if (!destino) return
    const op = oportunidades.find(o => o.id === active.id)
    if (!op || op.etapa === destino) return
    onMover(op, destino)
  }

  return (
    <DndContext id="crm-socios-quadro" sensors={sensores} onDragStart={aoComecar} onDragEnd={aoSoltar} onDragCancel={() => setAtivoId(null)}>
      <div className="flex gap-3 overflow-x-auto pb-4 pt-1 px-0.5 min-h-[520px]">
        {ETAPAS.map(e => (
          <Coluna key={e.id} etapa={e.id} ops={porEtapa[e.id]} hoje={hoje} onAbrir={onAbrir} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 160, easing: 'ease' }}>
        {ativa ? (
          <div
            className="rounded-xl shadow-2xl w-[236px] bg-white px-3.5 py-3"
            style={{ borderLeft: `3px solid ${ETAPA_PALETA[ativa.etapa].accent}` }}
          >
            <p className="text-sm font-semibold text-zinc-900 truncate">{ativa.nome}</p>
            {ativa.valor_estimado ? (
              <p className="text-xs font-bold mt-1" style={{ color: ETAPA_PALETA[ativa.etapa].accent }}>
                {formatarBRL(ativa.valor_estimado)}
              </p>
            ) : null}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
