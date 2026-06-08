import type { AuroraClienteConversa } from '@/lib/aurora-cliente'
import { formatDate } from '@/lib/utils'

const STATUS_LABELS: Record<AuroraClienteConversa['status'], string> = {
  respondida: 'Respondida',
  precisa_revisao: 'Precisa de revisão',
  encaminhada_equipe: 'Encaminhada à equipe',
}

const STATUS_CLASSES: Record<AuroraClienteConversa['status'], string> = {
  respondida: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  precisa_revisao: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  encaminhada_equipe: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
}

export default function AuroraClienteHistoricoList({
  items,
  showAuthor = false,
  emptyLabel = 'Nenhuma pergunta registrada ainda.',
}: {
  items: AuroraClienteConversa[]
  showAuthor?: boolean
  emptyLabel?: string
}) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-[#E8E3D8] bg-white px-5 py-8 text-center">
        <p className="text-[12px] text-[#9CA3AF]">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(item => (
        <article key={item.id} className="rounded-xl border border-[#E8E3D8] bg-white px-4 py-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${STATUS_CLASSES[item.status]}`}>
                {STATUS_LABELS[item.status]}
              </span>
              {item.precisa_retorno_humano && (
                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-rose-700 ring-1 ring-rose-200">
                  Retorno humano
                </span>
              )}
            </div>
            <span className="text-[10px] text-[#9CA3AF]">
              {formatDate(item.created_at)}
            </span>
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#9CA3AF]">Pergunta</p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[#1C1C2E]">
                {item.pergunta}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#9CA3AF]">Resposta</p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[#1C1C2E]">
                {item.resposta}
              </p>
            </div>

            {showAuthor && item.created_by_profile && (
              <p className="text-[11px] text-[#9CA3AF]">
                Criado por {item.created_by_profile.nome} · {item.created_by_profile.role}
              </p>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}
