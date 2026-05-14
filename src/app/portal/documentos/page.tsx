import { createClient } from '@/lib/supabase/server'
import { FileText, Download } from 'lucide-react'

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

  // Documentos uploaded liberados
  const { data: documentos } = await supabase
    .from('documentos')
    .select('id, nome_arquivo, tipo_documento, created_at')
    .eq('cliente_id', pc.cliente_id)
    .eq('liberado_cliente', true)
    .order('created_at', { ascending: false })

  // Documentos gerados (por IA) liberados
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
    <div className="space-y-5">
      <h1 className="text-[20px] font-semibold text-[#0f1923]">Documentos</h1>

      {!temDocs ? (
        <div className="bg-white rounded-2xl border border-[#D0DCDC] p-12 text-center shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <FileText size={32} className="mx-auto text-[#D0DCDC] mb-3" />
          <p className="text-[13px] text-[#9ca3af]">Nenhum documento disponível no momento.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Documentos gerados */}
          {gerados && gerados.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#D0DCDC] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <div className="px-5 py-3 border-b border-[#f5f7fa]">
                <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wide">Documentos do escritório</p>
              </div>
              {gerados.map((g, i) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const proc = (g as any).processo as { numero_processo: string | null; titulo: string } | null
                return (
                  <div
                    key={g.id}
                    className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? 'border-t border-[#f5f7fa]' : ''}`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#fef3e2] flex items-center justify-center shrink-0">
                      <FileText size={15} className="text-[#b8903a]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#0f1923] truncate">{g.titulo}</p>
                      {proc && (
                        <p className="text-[11px] text-[#9ca3af] mt-0.5">
                          {proc.numero_processo ?? proc.titulo}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] text-[#c5cdd8]">
                      {new Date(g.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Arquivos enviados pelo escritório */}
          {documentos && documentos.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#D0DCDC] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <div className="px-5 py-3 border-b border-[#f5f7fa]">
                <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wide">Arquivos disponíveis</p>
              </div>
              {documentos.map((d, i) => (
                <div
                  key={d.id}
                  className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? 'border-t border-[#f5f7fa]' : ''}`}
                >
                  <div className="w-9 h-9 rounded-xl bg-[#E8F0F0] flex items-center justify-center shrink-0">
                    <FileText size={15} className="text-[#145A5B]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0f1923] truncate">{d.nome_arquivo}</p>
                    <p className="text-[11px] text-[#9ca3af] mt-0.5">{d.tipo_documento}</p>
                  </div>
                  {/* Download via API para gerar signed URL */}
                  <a
                    href={`/api/portal/documentos?download=${d.id}`}
                    className="flex items-center gap-1.5 text-[12px] text-[#145A5B] font-medium hover:underline"
                  >
                    <Download size={13} />
                    Baixar
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
