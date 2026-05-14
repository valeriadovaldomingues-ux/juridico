import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Scale, ChevronRight, Clock } from 'lucide-react'

const AREA_LABELS: Record<string, string> = {
  civil: 'Cível', trabalhista: 'Trabalhista', criminal: 'Criminal',
  tributario: 'Tributário', previdenciario: 'Previdenciário',
  administrativo: 'Administrativo', familia: 'Família',
  empresarial: 'Empresarial', outro: 'Outro',
}

const STATUS_LABELS: Record<string, string> = {
  ativo: 'Ativo', suspenso: 'Suspenso',
  arquivado: 'Arquivado', encerrado: 'Encerrado',
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
    <div className="space-y-5">
      <h1 className="text-[20px] font-semibold text-[#0f1923]">Meus Processos</h1>

      {!processos?.length ? (
        <div className="bg-white rounded-2xl border border-[#D0DCDC] p-12 text-center shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <Scale size={32} className="mx-auto text-[#D0DCDC] mb-3" />
          <p className="text-[13px] text-[#9ca3af]">Nenhum processo disponível no momento.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#D0DCDC] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          {processos.map((p, i) => (
            <Link
              key={p.id}
              href={`/portal/processos/${p.id}`}
              className={`flex items-center gap-4 px-5 py-4 hover:bg-[#f9fafb] transition-colors group ${i > 0 ? 'border-t border-[#f5f7fa]' : ''}`}
            >
              <div className="w-9 h-9 rounded-xl bg-[#E8F0F0] flex items-center justify-center shrink-0">
                <Scale size={15} className="text-[#145A5B]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#0f1923] truncate">{p.titulo}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {p.numero_processo && (
                    <span className="text-[11px] text-[#9ca3af] font-mono">{p.numero_processo}</span>
                  )}
                  <span className="text-[11px] text-[#c5cdd8]">·</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E8F0F0] text-[#145A5B]">
                    {AREA_LABELS[p.area_direito] ?? p.area_direito}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f3f4f6] text-[#7a8899]">
                    {STATUS_LABELS[p.status] ?? p.status}
                  </span>
                </div>
              </div>
              <ChevronRight size={14} className="text-[#c5cdd8] group-hover:text-[#145A5B] shrink-0 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
