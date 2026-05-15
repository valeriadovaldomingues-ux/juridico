import { createClient } from '@/lib/supabase/server'
import { FileText }     from 'lucide-react'
import EmptyState        from '../_components/EmptyState'
import SecureDocumentCard from '../_components/SecureDocumentCard'

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

  const [
    { data: documentos },
    { data: processoIds },
  ] = await Promise.all([
    supabase.from('documentos')
      .select('id, nome_arquivo, tipo_documento, created_at')
      .eq('cliente_id', pc.cliente_id)
      .eq('liberado_cliente', true)
      .order('created_at', { ascending: false }),

    supabase.from('processos')
      .select('id, numero_processo, titulo')
      .eq('cliente_id', pc.cliente_id)
      .eq('visivel_cliente', true),
  ])

  const processoMap = Object.fromEntries(
    (processoIds ?? []).map(p => [p.id, p.numero_processo ?? p.titulo])
  )
  const ids = (processoIds ?? []).map(p => p.id)

  const { data: gerados } = ids.length > 0
    ? await supabase
        .from('doc_gerados')
        .select('id, titulo, created_at, processo_id, processo:processos(numero_processo, titulo)')
        .in('processo_id', ids)
        .eq('liberado_cliente', true)
        .order('created_at', { ascending: false })
    : { data: [] }

  const temDocs = (documentos?.length ?? 0) + (gerados?.length ?? 0) > 0
  const totalArquivos = (documentos?.length ?? 0) + (gerados?.length ?? 0)

  return (
    <div className="space-y-6">

      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-1">Portal</p>
          <h1
            className="text-[28px] text-[#1C1C2E] leading-none tracking-tight"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}
          >
            Documentos
          </h1>
        </div>
        {temDocs && (
          <span className="text-[11px] text-[#9CA3AF] tracking-wide tabular-nums">
            {totalArquivos} arquivo{totalArquivos !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {!temDocs ? (
        <EmptyState
          icon={FileText}
          titulo="Nenhum documento disponível"
          descricao="Os arquivos liberados pelo escritório aparecerão aqui para download seguro."
        />
      ) : (
        <div className="space-y-6">

          {/* Documentos gerados — sem download (só visualização de título) */}
          {gerados && gerados.length > 0 && (
            <div className="bg-white border border-[#E8E3D8] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#F0EBE4] bg-[#FDFAF7] flex items-center justify-between">
                <p className="text-[9px] font-semibold text-[#C49557] tracking-[0.2em] uppercase">
                  Documentos do escritório
                </p>
                <span className="text-[9px] text-[#C5C0B8] tabular-nums">{gerados.length}</span>
              </div>
              <div className="divide-y divide-[#F5F2EE]">
                {gerados.map(g => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const proc = (g as any).processo as { numero_processo: string | null; titulo: string } | null
                  const processoRef = proc?.numero_processo ?? proc?.titulo ?? undefined
                  return (
                    <div key={g.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#FDFAF7] transition-colors duration-150 group">
                      <div className="w-8 h-8 border border-[#E8E3D8] group-hover:border-[#C49557]/30 flex items-center justify-center shrink-0 transition-colors duration-200">
                        <FileText size={13} className="text-[#C49557]" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#1C1C2E] truncate">{g.titulo}</p>
                        {processoRef && (
                          <p className="text-[10px] text-[#9CA3AF] mt-0.5 tracking-wide truncate">{processoRef}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-[#C5C0B8] shrink-0 tabular-nums hidden sm:block">
                        {new Date(g.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Arquivos físicos — com download seguro */}
          {documentos && documentos.length > 0 && (
            <div className="bg-white border border-[#E8E3D8] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#F0EBE4] bg-[#FDFAF7] flex items-center justify-between">
                <p className="text-[9px] font-semibold text-[#C49557] tracking-[0.2em] uppercase">
                  Arquivos para download
                </p>
                <span className="text-[9px] text-[#C5C0B8] tabular-nums">{documentos.length}</span>
              </div>
              <div className="divide-y divide-[#F5F2EE]">
                {documentos.map(d => (
                  <SecureDocumentCard
                    key={d.id}
                    id={d.id}
                    nome={d.nome_arquivo}
                    tipo={d.tipo_documento}
                    data={d.created_at}
                    // Documentos da tabela `documentos` são por cliente_id, sem processo direto
                  />
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
