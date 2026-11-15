import Link from 'next/link'
import { CalendarDays, MapPin, Video } from 'lucide-react'
import { exigirSessaoPortal, dataPorExtenso } from '@/lib/portal-cliente/pagina'
import { listarAudienciasFuturas } from '@/lib/portal-cliente/consultas'
import EmptyState from '../_components/EmptyState'

export default async function PortalAgendaPage() {
  const { session, db } = await exigirSessaoPortal()
  const audiencias = await listarAudienciasFuturas(db, session.clienteId)

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <p className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-1">Portal</p>
        <h1 className="text-[26px] sm:text-[28px] text-[#1C1C2E] leading-none tracking-tight" style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}>
          Próximas audiências
        </h1>
      </div>

      {audiencias.length === 0 ? (
        <EmptyState icon={CalendarDays} titulo="Nenhuma audiência marcada" descricao="Quando uma audiência for marcada em algum dos seus processos, ela aparece aqui." />
      ) : (
        <div className="space-y-3">
          {audiencias.map(a => (
            <Link key={a.id} href={`/portal/processos/${a.processoId}`} className="block bg-white border border-[#E8E3D8] hover:border-[#C49557]/40 transition-colors p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-[#1C1C2E]">{a.tipo}</p>
                  <p className="text-[11px] text-[#9CA3AF] mt-1 break-all">{a.processoNumero ?? a.processoTitulo}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[12px] text-[#1C1C2E]">{dataPorExtenso(a.data)}</p>
                  {a.hora && <p className="text-[11px] text-[#9CA3AF]">às {a.hora}h</p>}
                </div>
              </div>
              {(a.modalidade || a.local) && (
                <p className="text-[12px] text-[#6B7280] mt-3 inline-flex items-start gap-1.5">
                  {a.modalidade?.startsWith('Por video') ? <Video size={12} className="mt-0.5 shrink-0" /> : <MapPin size={12} className="mt-0.5 shrink-0" />}
                  <span>{[a.modalidade, a.local].filter(Boolean).join(' — ')}</span>
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
      <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
        Datas e horários podem mudar. O escritório avisa você se houver qualquer alteração.
      </p>
    </div>
  )
}
