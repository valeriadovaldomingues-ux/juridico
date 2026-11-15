import Link from 'next/link'
import { Scale, CalendarDays, ArrowRight, Clock } from 'lucide-react'
import { exigirSessaoPortal, dataCurta, dataPorExtenso } from '@/lib/portal-cliente/pagina'
import { montarResumo } from '@/lib/portal-cliente/consultas'
import PortalStatCard from './_components/PortalStatCard'
import BaixarRelatorio from './_components/BaixarRelatorio'

export default async function PortalInicio() {
  const { session, db } = await exigirSessaoPortal()
  const resumo = await montarResumo(db, session.clienteId)
  const primeiroNome = session.clienteNome.split(' ')[0] || 'Cliente'

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-1">Bem-vindo(a)</p>
          <h1 className="text-[26px] sm:text-[30px] text-[#1C1C2E] leading-tight tracking-tight" style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}>
            Olá, {primeiroNome}
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-2 max-w-xl leading-relaxed">
            Aqui você acompanha os seus processos, as próximas audiências e o que aconteceu por último. Se algo não estiver claro, é só falar com o escritório.
          </p>
        </div>
        <BaixarRelatorio />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <PortalStatCard icon={Scale} label="Seus processos" value={resumo.totalProcessos} href="/portal/processos" />
        <PortalStatCard icon={CalendarDays} label="Próximas audiências" value={resumo.proximasAudiencias.length} href="/portal/agenda" accent />
      </div>

      {/* Próximas audiências */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase">Próximas audiências</h2>
          <Link href="/portal/agenda" className="text-[10px] text-[#C49557] tracking-wider uppercase hover:underline inline-flex items-center gap-1">Ver todas <ArrowRight size={10} /></Link>
        </div>
        {resumo.proximasAudiencias.length === 0 ? (
          <div className="bg-white border border-[#E8E3D8] px-5 py-6 text-[13px] text-[#6B7280]">
            Nenhuma audiência marcada por enquanto. Quando houver, ela aparece aqui.
          </div>
        ) : (
          <div className="bg-white border border-[#E8E3D8] divide-y divide-[#F5F2EE]">
            {resumo.proximasAudiencias.map(a => (
              <Link key={a.id} href={`/portal/processos/${a.processoId}`} className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-[#FDFBF8] transition-colors">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[#1C1C2E]">{a.tipo}</p>
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5 truncate">{a.processoNumero ?? a.processoTitulo}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[12px] text-[#1C1C2E] tabular-nums">{dataCurta(a.data)}</p>
                  {a.hora && <p className="text-[11px] text-[#9CA3AF]">às {a.hora}h</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Últimos andamentos */}
      <section className="space-y-3">
        <h2 className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase">Últimas movimentações</h2>
        {resumo.ultimosAndamentos.length === 0 ? (
          <div className="bg-white border border-[#E8E3D8] px-5 py-6 text-[13px] text-[#6B7280]">
            Ainda não há movimentações para mostrar. Assim que o processo andar, você vê aqui.
          </div>
        ) : (
          <div className="bg-white border border-[#E8E3D8] divide-y divide-[#F5F2EE]">
            {resumo.ultimosAndamentos.map(a => (
              <Link key={a.id} href={`/portal/processos/${a.processoId}`} className="block px-5 py-4 hover:bg-[#FDFBF8] transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-[13px] font-medium text-[#1C1C2E] leading-snug">{a.titulo}</p>
                  <span className="text-[11px] text-[#9CA3AF] shrink-0 inline-flex items-center gap-1"><Clock size={10} />{dataPorExtenso(a.data)}</span>
                </div>
                <p className="text-[11px] text-[#9CA3AF] mt-1 truncate">{a.tipo} · {a.processoNumero ?? a.processoTitulo}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
        Processos em segredo de justiça e os que o escritório optou por não exibir aqui não aparecem nesta lista. Em caso de dúvida, fale com o escritório.
      </p>
    </div>
  )
}
