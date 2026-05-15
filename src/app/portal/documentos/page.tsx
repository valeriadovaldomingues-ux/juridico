import { createClient } from '@/lib/supabase/server'
import { FileText, Download, ArrowDownToLine } from 'lucide-react'

export default async function PortalDocumentosPage() {
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

  const { data: documentos } = await supabase
    .from('documentos')
    .select('id, nome_arquivo, tipo_documento, created_at')
    .eq('cliente_id', pc.cliente_id)
    .eq('liberado_cliente', true)
    .order('created_at', { ascending: false })

  const { data: processoIds } = await supabase
    .from('processos')
    .select('id')
    .eq('cliente_id', pc.cliente_id)
    .eq('visivel_cliente', true)

  const ids = (processoIds ?? []).map(p => p.id)

  const { data: gerados } = ids.length > 0
    ? await supabase
        .from('doc_gerados')
        .select('id, titulo, created_at, processo:processos(numero_processo, titulo)')
        .in('processo_id', ids)
        .eq('liberado_cliente', true)
        .order('created_at', { ascending: false })
    : { data: [] }

  const temDocs = (documentos?.length ?? 0) + (gerados?.length ?? 0) > 0

  return (
    <div className="space-y-6">

      <div>
        <p className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-1">Portal</p>
        <h1
          className="text-[28px] text-[#1C1C2E] leading-none tracking-tight"
          style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}
        >
          Documentos
        </h1>
      </div>

      {!temDocs ? (

        <div className="bg-white border border-[#E8E3D8] px-8 py-14 text-center">
          <FileText size={28} className="mx-auto text-[#E8E3D8] mb-4" strokeWidth={1} />
          <p className="text-[13px] text-[#9CA3AF]">Nenhum documento disponível no momento.</p>
          <p className="text-[11px] text-[#C5C0B8] mt-1">
            Os documentos liberados pelo escritório aparecerão aqui.
          </p>
        </div>

      ) : (
        <div className="space-y-6">

          {/* Documentos gerados pelo escritório */}
          {gerados && gerados.length > 0 && (
            <div className="bg-white border border-[#E8E3D8] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#F0EBE4] bg-[#FDFAF7]">
                <p className="text-[9px] font-medium text-[#C49557] tracking-[0.2em] uppercase">
                  Documentos do escritório
                </p>
              </div>
              <div className="divide-y divide-[#F5F2EE]">
                {gerados.map(g => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const proc = (g as any).processo as { numero_processo: string | null; titulo: string } | null
                  return (
                    <div key={g.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="w-8 h-8 border border-[#E8E3D8] flex items-center justify-center shrink-0">
                        <FileText size={13} className="text-[#C49557]" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#1C1C2E] truncate">{g.titulo}</p>
                        {proc && (
                          <p className="text-[10px] text-[#9CA3AF] mt-0.5 tracking-wide">
                            {proc.numero_processo ?? proc.titulo}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-[#C5C0B8] shrink-0">
                        {new Date(g.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Arquivos para download */}
          {documentos && documentos.length > 0 && (
            <div className="bg-white border border-[#E8E3D8] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#F0EBE4] bg-[#FDFAF7]">
                <p className="text-[9px] font-medium text-[#C49557] tracking-[0.2em] uppercase">
                  Arquivos disponíveis para download
                </p>
              </div>
              <div className="divide-y divide-[#F5F2EE]">
                {documentos.map(d => (
                  <div key={d.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-8 h-8 border border-[#E8E3D8] flex items-center justify-center shrink-0">
                      <ArrowDownToLine size={13} className="text-[#C49557]" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#1C1C2E] truncate">{d.nome_arquivo}</p>
                      <p className="text-[10px] text-[#9CA3AF] mt-0.5 tracking-wide">{d.tipo_documento}</p>
                    </div>
                    <a
                      href={`/api/portal/documentos?download=${d.id}`}
                      className="flex items-center gap-1.5 text-[10px] text-white bg-[#C49557] hover:bg-[#A8803D] px-3 py-1.5 tracking-[0.1em] uppercase transition-colors shrink-0"
                    >
                      <Download size={11} />
                      Baixar
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
