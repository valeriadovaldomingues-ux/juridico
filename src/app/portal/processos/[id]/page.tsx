import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Scale, Users } from 'lucide-react'
import { exigirSessaoPortal, dataPorExtenso } from '@/lib/portal-cliente/pagina'
import { AREA_LABELS, listarAndamentos, listarPartes, obterProcessoDoCliente } from '@/lib/portal-cliente/consultas'
import ProcessStatusBadge from '../../_components/ProcessStatusBadge'
import TimelineItem from '../../_components/TimelineItem'

export default async function PortalProcessoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { session, db } = await exigirSessaoPortal()

  // O id da URL só vale se o processo for DESTE cliente e estiver visível; senão, 404 (igual para qualquer motivo).
  const processo = await obterProcessoDoCliente(db, session.clienteId, id)
  if (!processo) notFound()

  const [partesPorProcesso, andamentos] = await Promise.all([listarPartes(db, [processo.id]), listarAndamentos(db, processo.id)])
  const partes = partesPorProcesso.get(processo.id) ?? []

  const dados: [string, string | null][] = [
    ['Área', processo.area ? AREA_LABELS[processo.area] ?? processo.area : null],
    ['Tipo de ação', processo.classe],
    ['Fase', processo.fase],
    ['Tribunal', processo.tribunal],
    ['Vara', processo.vara],
    ['Comarca', processo.comarca],
    ['Distribuição', processo.distribuicao ? dataPorExtenso(processo.distribuicao) : null],
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/portal/processos" className="inline-flex items-center gap-1.5 text-[10px] text-[#9CA3AF] hover:text-[#C49557] tracking-[0.1em] uppercase transition-colors">
        <ArrowLeft size={11} /> Processos
      </Link>

      <div className="bg-[#0C1B2A] px-5 sm:px-6 py-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C49557]/40 to-transparent" />
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 border border-[#C49557]/30 hidden sm:flex items-center justify-center shrink-0 mt-0.5">
            <Scale size={16} className="text-[#C49557]" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-white text-[19px] sm:text-[22px] leading-snug tracking-tight" style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}>
              {processo.titulo}
            </h1>
            {processo.numero && <p className="text-white/40 text-[11px] font-mono mt-1 tracking-wide break-all">{processo.numero}</p>}
          </div>
          <ProcessStatusBadge status={processo.status} />
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 mt-6">
          {dados.filter(([, v]) => v).map(([k, v]) => (
            <div key={k}>
              <dt className="text-[9px] text-[#C49557]/70 tracking-[0.15em] uppercase mb-0.5">{k}</dt>
              <dd className="text-white/80 text-[12px]">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <section>
        <h2 className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-3">Partes do processo</h2>
        {partes.length === 0 ? (
          <div className="bg-white border border-[#E8E3D8] px-5 py-6 text-center">
            <Users size={18} className="mx-auto text-[#E8E3D8] mb-2" strokeWidth={1} />
            <p className="text-[12px] text-[#9CA3AF]">Partes não informadas.</p>
          </div>
        ) : (
          <div className="bg-white border border-[#E8E3D8] divide-y divide-[#F5F2EE]">
            {partes.map((p, i) => (
              <div key={`${p.nome}-${i}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-[13px] text-[#1C1C2E] font-medium">{p.nome}</span>
                <span className="text-[9px] text-[#9CA3AF] border border-[#E8E3D8] px-1.5 py-0.5 tracking-wide uppercase shrink-0">{p.tipo}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-3">Andamentos</h2>
        {andamentos.length === 0 ? (
          <div className="bg-white border border-[#E8E3D8] px-6 py-8 text-center">
            <p className="text-[13px] text-[#6B7280]">Ainda não há andamentos para mostrar.</p>
            <p className="text-[11px] text-[#9CA3AF] mt-1">Se você esperava ver algo aqui, fale com o escritório.</p>
          </div>
        ) : (
          <div className="bg-white border border-[#E8E3D8] px-5 py-5">
            {andamentos.map((a, i) => (
              <TimelineItem
                key={a.id}
                data={a.data}
                titulo={a.titulo}
                subtitulo={a.tipo}
                detalhe={a.descricao ? `${a.tipo}: ${a.descricao}` : undefined}
                tipo={a.tipo === 'Audiência' ? 'audiencia' : 'publicacao'}
                last={i === andamentos.length - 1}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
