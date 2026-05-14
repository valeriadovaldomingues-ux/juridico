import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Scale, Users, Newspaper } from 'lucide-react'

const TIPO_PARTE_LABELS: Record<string, string> = {
  autor: 'Autor', reu: 'Réu', terceiro: 'Terceiro', outro: 'Outro',
}

const TIPO_PUB_LABELS: Record<string, string> = {
  intimacao: 'Intimação', publicacao: 'Publicação', despacho: 'Despacho',
  sentenca: 'Sentença', acordao: 'Acórdão', outro: 'Outro',
}

export default async function PortalProcessoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  const { data: processo } = await supabase
    .from('processos')
    .select('id, numero_processo, titulo, area_direito, status, fase, tribunal, vara, valor_causa, data_distribuicao, observacoes')
    .eq('id', id)
    .eq('cliente_id', pc.cliente_id)
    .eq('visivel_cliente', true)
    .single()

  if (!processo) notFound()

  const [{ data: partes }, { data: publicacoes }] = await Promise.all([
    supabase.from('partes_processo').select('id, pessoa_nome, tipo_parte').eq('processo_id', id),
    supabase.from('publicacoes')
      .select('id, tipo_publicacao, data_publicacao, resumo, prazo_detectado, prazo_data, audiencia_detectada, audiencia_data')
      .eq('processo_id', id)
      .order('data_publicacao', { ascending: false })
      .limit(10),
  ])

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/portal/processos" className="text-[12px] text-[#7a8899] hover:text-[#145A5B] flex items-center gap-1 transition-colors">
          <ArrowLeft size={13} /> Processos
        </Link>
      </div>

      {/* Cabeçalho */}
      <div className="bg-white rounded-2xl border border-[#D0DCDC] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E8F0F0] flex items-center justify-center shrink-0 mt-0.5">
            <Scale size={16} className="text-[#145A5B]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[16px] font-semibold text-[#0f1923]">{processo.titulo}</h1>
            {processo.numero_processo && (
              <p className="text-[12px] text-[#9ca3af] font-mono mt-0.5">{processo.numero_processo}</p>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 mt-5 text-[13px]">
          {[
            ['Tribunal', processo.tribunal],
            ['Vara', processo.vara],
            ['Fase', processo.fase],
            ['Status', processo.status],
            ['Distribuição', processo.data_distribuicao
              ? new Date(processo.data_distribuicao).toLocaleDateString('pt-BR')
              : null],
            ['Valor da causa', processo.valor_causa
              ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(processo.valor_causa)
              : null],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={String(k)}>
              <dt className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wide">{k}</dt>
              <dd className="text-[#374151] mt-0.5">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Partes */}
      {partes && partes.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#D0DCDC] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <h2 className="text-[13px] font-semibold text-[#0f1923] mb-4 flex items-center gap-2">
            <Users size={14} className="text-[#145A5B]" /> Partes
          </h2>
          <div className="divide-y divide-[#f5f7fa]">
            {partes.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2.5">
                <span className="text-[13px] text-[#374151]">{p.pessoa_nome}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f3f4f6] text-[#7a8899]">
                  {TIPO_PARTE_LABELS[p.tipo_parte] ?? p.tipo_parte}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Publicações recentes */}
      {publicacoes && publicacoes.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#D0DCDC] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <h2 className="text-[13px] font-semibold text-[#0f1923] mb-4 flex items-center gap-2">
            <Newspaper size={14} className="text-[#145A5B]" /> Publicações recentes
          </h2>
          <div className="divide-y divide-[#f5f7fa]">
            {publicacoes.map(pub => (
              <div key={pub.id} className="py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-[#145A5B]">
                    {TIPO_PUB_LABELS[pub.tipo_publicacao] ?? pub.tipo_publicacao}
                  </span>
                  {pub.data_publicacao && (
                    <span className="text-[11px] text-[#c5cdd8]">
                      {new Date(pub.data_publicacao).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
                {pub.resumo && (
                  <p className="text-[12px] text-[#7a8899] leading-relaxed">{pub.resumo}</p>
                )}
                {pub.prazo_detectado && pub.prazo_data && (
                  <p className="text-[11px] text-[#e74c3c] mt-1 font-medium">
                    ⚠ Prazo: {new Date(pub.prazo_data).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
