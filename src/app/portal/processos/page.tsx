import { createClient } from '@/lib/supabase/server'
import Link             from 'next/link'
import { Scale, ArrowRight } from 'lucide-react'
import EmptyState from '../_components/EmptyState'

const AREA_LABELS: Record<string, string> = {
  civil: 'Cível', trabalhista: 'Trabalhista', criminal: 'Criminal',
  tributario: 'Tributário', previdenciario: 'Previdenciário',
  administrativo: 'Administrativo', familia: 'Família',
  empresarial: 'Empresarial', outro: 'Outro',
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  ativo:     { label: 'Ativo',     dot: 'bg-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
  suspenso:  { label: 'Suspenso',  dot: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50  border-amber-100'   },
  arquivado: { label: 'Arquivado', dot: 'bg-[#C5C0B8]',   text: 'text-[#6B7280]',  bg: 'bg-[#F5F2EE] border-[#E8E3D8]'  },
  encerrado: { label: 'Encerrado', dot: 'bg-[#9CA3AF]',   text: 'text-[#9CA3AF]',  bg: 'bg-[#F9F9F9] border-[#E8E3D8]'  },
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
          <span className="text-[11px] text-[#9CA3AF] tracking-wide tabular-nums">
            {processos.length} {processos.length === 1 ? 'processo' : 'processos'}
          </span>
        ) : null}
      </div>

      {!processos?.length ? (
        <EmptyState
          icon={Scale}
          titulo="Nenhum processo disponível"
          descricao="Os processos liberados pelo escritório aparecerão aqui."
        />
      ) : (
        <div className="bg-white border border-[#E8E3D8] overflow-hidden divide-y divide-[#F5F2EE]">
          {processos.map(p => {
            const st = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.arquivado
            return (
              <Link
                key={p.id}
                href={`/portal/processos/${p.id}`}
                className="relative flex items-center gap-4 px-5 py-4 hover:bg-[#FDFAF7] transition-all duration-200 group overflow-hidden"
              >
                {/* Gold left border — aparece no hover com escala */}
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#C49557] scale-y-0 group-hover:scale-y-100 origin-center transition-transform duration-200" />

                {/* Ícone */}
                <div className="w-9 h-9 border border-[#E8E3D8] group-hover:border-[#C49557]/30 flex items-center justify-center shrink-0 transition-colors duration-200">
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
                    <span className="text-[10px] text-[#DDD8D0]">·</span>
                    <span className="text-[10px] text-[#9CA3AF]">
                      {AREA_LABELS[p.area_direito] ?? p.area_direito}
                    </span>
                    {p.tribunal && (
                      <>
                        <span className="text-[10px] text-[#DDD8D0]">·</span>
                        <span className="text-[10px] text-[#9CA3AF]">{p.tribunal}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status badge com dot */}
                <div className={`hidden sm:flex items-center gap-1.5 text-[9px] font-medium px-2 py-1 border tracking-wide uppercase ${st.bg} ${st.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                  {st.label}
                </div>

                <ArrowRight
                  size={13}
                  className="text-[#DDD8D0] group-hover:text-[#C49557] shrink-0 transition-colors duration-200"
                />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
