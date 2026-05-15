import { createClient } from '@/lib/supabase/server'
import Link             from 'next/link'
import { Scale, ArrowRight } from 'lucide-react'

const AREA_LABELS: Record<string, string> = {
  civil: 'Cível', trabalhista: 'Trabalhista', criminal: 'Criminal',
  tributario: 'Tributário', previdenciario: 'Previdenciário',
  administrativo: 'Administrativo', familia: 'Família',
  empresarial: 'Empresarial', outro: 'Outro',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ativo:     { label: 'Ativo',     color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
  suspenso:  { label: 'Suspenso',  color: 'text-amber-700  bg-amber-50  border-amber-100'  },
  arquivado: { label: 'Arquivado', color: 'text-[#9CA3AF]  bg-[#F9F9F9] border-[#E8E3D8]' },
  encerrado: { label: 'Encerrado', color: 'text-[#6B7280]  bg-[#F3F4F6] border-[#E5E7EB]' },
}

export default async function PortalProcessosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: pc } = await supabase
    .from('portal_clientes')
    .select('cliente_id')
    .eq('auth_user_id', user.id)
    .eq('ativo', true)
    .single()

  if (!pc) return null

  const { data: processos } = await supabase
    .from('processos')
    .select('id, numero_processo, titulo, area_direito, status, tribunal, created_at')
    .eq('cliente_id', pc.cliente_id)
    .eq('visivel_cliente', true)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">

      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-1">Portal</p>
          <h1
            className="text-[28px] text-[#1C1C2E] leading-none tracking-tight"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}
          >
            Meus Processos
          </h1>
        </div>
        {processos?.length ? (
          <span className="text-[11px] text-[#9CA3AF] tracking-wide">
            {processos.length} {processos.length === 1 ? 'processo' : 'processos'}
          </span>
        ) : null}
      </div>

      {!processos?.length ? (

        <div className="bg-white border border-[#E8E3D8] px-8 py-14 text-center">
          <Scale size={28} className="mx-auto text-[#E8E3D8] mb-4" strokeWidth={1} />
          <p className="text-[13px] text-[#9CA3AF]">Nenhum processo disponível no momento.</p>
          <p className="text-[11px] text-[#C5C0B8] mt-1">
            Os processos liberados pelo escritório aparecerão aqui.
          </p>
        </div>

      ) : (

        <div className="bg-white border border-[#E8E3D8] overflow-hidden divide-y divide-[#F0EBE4]">
          {processos.map(p => {
            const status = STATUS_CONFIG[p.status] ?? { label: p.status, color: 'text-[#9CA3AF] bg-[#F9F9F9] border-[#E8E3D8]' }
            return (
              <Link
                key={p.id}
                href={`/portal/processos/${p.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-[#FDFAF7] transition-colors group"
              >
                {/* Ícone */}
                <div className="w-9 h-9 border border-[#E8E3D8] group-hover:border-[#C49557]/30 flex items-center justify-center shrink-0 transition-colors">
                  <Scale size={14} className="text-[#C49557]" strokeWidth={1.5} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#1C1C2E] truncate leading-snug">
                    {p.titulo}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {p.numero_processo && (
                      <span className="text-[10px] text-[#9CA3AF] font-mono tracking-wide">
                        {p.numero_processo}
                      </span>
                    )}
                    <span className="text-[10px] text-[#C5C0B8]">·</span>
                    <span className="text-[10px] text-[#9CA3AF]">
                      {AREA_LABELS[p.area_direito] ?? p.area_direito}
                    </span>
                    {p.tribunal && (
                      <>
                        <span className="text-[10px] text-[#C5C0B8]">·</span>
                        <span className="text-[10px] text-[#9CA3AF]">{p.tribunal}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status */}
                <span className={`text-[9px] font-medium px-2 py-0.5 border tracking-wide uppercase hidden sm:block ${status.color}`}>
                  {status.label}
                </span>

                <ArrowRight
                  size={13}
                  className="text-[#E8E3D8] group-hover:text-[#C49557] shrink-0 transition-colors"
                />
              </Link>
            )
          })}
        </div>

      )}
    </div>
  )
}
