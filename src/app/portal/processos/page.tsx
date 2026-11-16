import Link from 'next/link'
import { Scale, ArrowRight } from 'lucide-react'
import { exigirSessaoPortal } from '@/lib/portal-cliente/pagina'
import { listarProcessosDoCliente, AREA_LABELS } from '@/lib/portal-cliente/consultas'
import ProcessStatusBadge from '../_components/ProcessStatusBadge'
import EmptyState from '../_components/EmptyState'
import BaixarRelatorio from '../_components/BaixarRelatorio'

export default async function PortalProcessosPage() {
  const { session, db } = await exigirSessaoPortal()
  const processos = await listarProcessosDoCliente(db, session.clienteId)

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-1">Portal</p>
          <h1 className="text-[26px] sm:text-[28px] text-[#1C1C2E] leading-none tracking-tight" style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}>
            Seus processos
          </h1>
        </div>
        {processos.length > 0 && <BaixarRelatorio compacto />}
      </div>

      {processos.length === 0 ? (
        <EmptyState icon={Scale} titulo="Nenhum processo para mostrar" descricao="Quando houver processos disponíveis para consulta, eles aparecem aqui." />
      ) : (
        <div className="space-y-3">
          {processos.map(p => (
            <Link key={p.id} href={`/portal/processos/${p.id}`} className="group block bg-white border border-[#E8E3D8] hover:border-[#C49557]/40 transition-colors p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-[#1C1C2E] leading-snug">{p.titulo}</p>
                  {p.numero && <p className="text-[11px] font-mono text-[#9CA3AF] mt-1 break-all">{p.numero}</p>}
                </div>
                <ProcessStatusBadge status={p.status} size="sm" />
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-[11px] text-[#6B7280]">
                  {[p.area ? AREA_LABELS[p.area] ?? p.area : null, p.tribunal, p.fase].filter(Boolean).join(' · ')}
                </p>
                <ArrowRight size={13} className="text-[#C5C0B8] group-hover:text-[#C49557] transition-colors shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
