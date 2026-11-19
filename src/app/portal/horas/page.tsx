import Link from 'next/link'
import { Clock } from 'lucide-react'
import { exigirSessaoPortal, dataCurta } from '@/lib/portal-cliente/pagina'
import { listarHoras, mesesComHoras, mesValido, totalMinutos } from '@/lib/portal-cliente/horas'
import { formatDurationMinutes } from '@/lib/agenda-time-entries'
import EmptyState from '../_components/EmptyState'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const nomeMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`
const curto = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1].slice(0, 3)}/${m.slice(2, 4)}`

export default async function PortalHorasPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: mesParam } = await searchParams
  const { session, db } = await exigirSessaoPortal()
  const horas = await listarHoras(db, session.clienteId)
  const meses = mesesComHoras(horas)

  const todos = mesParam === 'todos'
  const mes = !todos && mesValido(mesParam) && meses.includes(mesParam) ? mesParam : meses[0] ?? null
  const doPeriodo = todos ? horas : horas.filter(h => h.data.startsWith(mes ?? '#'))

  // Subtotal por processo no período (horas sem processo visível ficam em "Outras atividades").
  const porProcesso = new Map<string, number>()
  for (const h of doPeriodo) {
    const k = h.processoNumero ?? 'Outras atividades'
    porProcesso.set(k, (porProcesso.get(k) ?? 0) + h.minutos)
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <p className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-1">Portal</p>
        <h1 className="text-[26px] sm:text-[28px] text-[#1C1C2E] leading-none tracking-tight" style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}>
          Horas utilizadas
        </h1>
      </div>

      {horas.length === 0 ? (
        <EmptyState icon={Clock} titulo="Nenhuma hora registrada" descricao="Quando o escritório registrar tempo de trabalho para você, ele aparece aqui." />
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {meses.map(m => (
              <Link
                key={m}
                href={`/portal/horas?mes=${m}`}
                className={`text-[11px] px-3 py-1.5 border transition-colors ${!todos && m === mes ? 'bg-[#0C1B2A] text-white border-[#0C1B2A]' : 'bg-white text-[#6B7280] border-[#E8E3D8] hover:border-[#C49557]/50'}`}
              >
                {curto(m)}
              </Link>
            ))}
            <Link
              href="/portal/horas?mes=todos"
              className={`text-[11px] px-3 py-1.5 border transition-colors ${todos ? 'bg-[#0C1B2A] text-white border-[#0C1B2A]' : 'bg-white text-[#6B7280] border-[#E8E3D8] hover:border-[#C49557]/50'}`}
            >
              Todo o período
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-[#E8E3D8] px-5 py-4">
              <p className="text-[10px] text-[#9CA3AF] tracking-[0.15em] uppercase mb-1">{todos ? 'Todo o período' : mes ? nomeMes(mes) : ''}</p>
              <p className="text-[24px] text-[#1C1C2E] tabular-nums" style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}>{formatDurationMinutes(totalMinutos(doPeriodo))}</p>
            </div>
            <div className="bg-white border border-[#E8E3D8] px-5 py-4">
              <p className="text-[10px] text-[#9CA3AF] tracking-[0.15em] uppercase mb-1">Total acumulado</p>
              <p className="text-[24px] text-[#1C1C2E] tabular-nums" style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}>{formatDurationMinutes(totalMinutos(horas))}</p>
            </div>
          </div>

          {porProcesso.size > 1 && (
            <section>
              <h2 className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-3">Por processo</h2>
              <div className="bg-white border border-[#E8E3D8] divide-y divide-[#F5F2EE]">
                {[...porProcesso.entries()].sort((a, b) => b[1] - a[1]).map(([nome, min]) => (
                  <div key={nome} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-[12px] text-[#1C1C2E] break-all">{nome}</span>
                    <span className="text-[12px] text-[#1C1C2E] tabular-nums shrink-0">{formatDurationMinutes(min)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-3">Atividades</h2>
            <div className="bg-white border border-[#E8E3D8] divide-y divide-[#F5F2EE]">
              {doPeriodo.map(h => (
                <div key={h.id} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[12px] text-[#1C1C2E] leading-snug break-words">{h.atividade}</p>
                    <p className="text-[10px] text-[#9CA3AF] mt-0.5 tracking-wide">
                      {dataCurta(h.data)}{h.processoNumero ? ` · ${h.processoNumero}` : ''}
                    </p>
                  </div>
                  <span className="text-[12px] text-[#1C1C2E] tabular-nums shrink-0">{formatDurationMinutes(h.minutos)}</span>
                </div>
              ))}
            </div>
          </section>

          <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
            Mostra o tempo dedicado ao seu atendimento. Em caso de dúvida sobre algum lançamento, fale com o escritório.
          </p>
        </>
      )}
    </div>
  )
}
