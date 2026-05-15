import { createClient } from '@/lib/supabase/server'
import { notFound }     from 'next/navigation'
import { isUUID }       from '@/lib/portal/validate'
import Link             from 'next/link'
import { ArrowLeft, Scale, Users, Newspaper, AlertTriangle } from 'lucide-react'

const TIPO_PARTE_LABELS: Record<string, string> = {
  autor: 'Autor', reu: 'Réu', terceiro: 'Terceiro', outro: 'Outro',
}

const TIPO_PUB_LABELS: Record<string, string> = {
  intimacao: 'Intimação', publicacao: 'Publicação', despacho: 'Despacho',
  sentenca:   'Sentença',  acordao:   'Acórdão',    outro:    'Outro',
}

export default async function PortalProcessoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Valida UUID antes de qualquer query — nunca enviar string arbitrária ao banco
  if (!isUUID(id)) notFound()

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

  // Campos expostos ao cliente — mínimo necessário.
  // EXCLUÍDOS intencionalmente:
  //   observacoes      — campo interno estratégico: nunca expor ao cliente
  //   valor_causa      — oculto até definição formal de política de exposição
  //   advogado_responsavel_id — UUID interno sem valor para o cliente
  const { data: processo } = await supabase
    .from('processos')
    .select('id, numero_processo, titulo, area_direito, status, fase, tribunal, vara, data_distribuicao')
    .eq('id', id)
    .eq('cliente_id', pc.cliente_id)
    .eq('visivel_cliente', true)
    .single()

  if (!processo) notFound()

  const [{ data: partes }, { data: publicacoes }] = await Promise.all([
    // EXCLUÍDOS: documento (CPF/CNPJ — dado pessoal de terceiro), observacoes (notas internas)
    supabase
      .from('partes_processo')
      .select('id, pessoa_nome, tipo_parte')
      .eq('processo_id', id),
    // EXCLUÍDOS: texto_publicacao, hash, status (workflow), advogado_monitorado_id,
    //            oab_pesquisada, termo_encontrado, origem
    supabase
      .from('publicacoes')
      .select('id, tipo_publicacao, data_publicacao, resumo, prazo_detectado, prazo_data, audiencia_detectada, audiencia_data')
      .eq('processo_id', id)
      .order('data_publicacao', { ascending: false })
      .limit(10),
  ])

  const AREA_LABELS: Record<string, string> = {
    civil: 'Cível', trabalhista: 'Trabalhista', criminal: 'Criminal',
    tributario: 'Tributário', previdenciario: 'Previdenciário',
    administrativo: 'Administrativo', familia: 'Família',
    empresarial: 'Empresarial', outro: 'Outro',
  }

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Voltar ─────────────────────────────────────────────────────────── */}
      <Link
        href="/portal/processos"
        className="inline-flex items-center gap-1.5 text-[10px] text-[#9CA3AF] hover:text-[#C49557] tracking-[0.1em] uppercase transition-colors"
      >
        <ArrowLeft size={11} />
        Processos
      </Link>

      {/* ── Cabeçalho do processo ─────────────────────────────────────────── */}
      <div className="bg-[#0C1B2A] px-6 py-7 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C49557]/40 to-transparent" />

        <div className="flex items-start gap-4">
          <div className="w-10 h-10 border border-[#C49557]/30 flex items-center justify-center shrink-0 mt-0.5">
            <Scale size={16} className="text-[#C49557]" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h1
              className="text-white text-[22px] leading-snug tracking-tight"
              style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}
            >
              {processo.titulo}
            </h1>
            {processo.numero_processo && (
              <p className="text-white/35 text-[11px] font-mono mt-1 tracking-wide">
                {processo.numero_processo}
              </p>
            )}
          </div>
        </div>

        {/* Metadados */}
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 mt-6">
          {([
            ['Área',         AREA_LABELS[processo.area_direito] ?? processo.area_direito],
            ['Status',       processo.status],
            ['Fase',         processo.fase],
            ['Tribunal',     processo.tribunal],
            ['Vara',         processo.vara],
            ['Distribuição', processo.data_distribuicao
              ? new Date(processo.data_distribuicao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
              : null],
          ] as [string, string | null][]).filter(([, v]) => v).map(([k, v]) => (
            <div key={k}>
              <dt className="text-[9px] text-[#C49557]/70 tracking-[0.15em] uppercase mb-0.5">{k}</dt>
              <dd className="text-white/80 text-[12px]">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ── Partes ───────────────────────────────────────────────────────────── */}
      {partes && partes.length > 0 && (
        <div className="bg-white border border-[#E8E3D8]">
          <div className="px-5 py-3.5 border-b border-[#F0EBE4] flex items-center gap-2">
            <Users size={13} className="text-[#C49557]" strokeWidth={1.5} />
            <h2 className="text-[11px] tracking-[0.1em] uppercase text-[#5A5A70] font-medium">
              Partes do processo
            </h2>
          </div>
          <div className="divide-y divide-[#F5F2EE]">
            {partes.map(p => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <span className="text-[13px] text-[#1C1C2E]">{p.pessoa_nome}</span>
                <span className="text-[9px] text-[#9CA3AF] border border-[#E8E3D8] px-2 py-0.5 tracking-wide uppercase">
                  {TIPO_PARTE_LABELS[p.tipo_parte] ?? p.tipo_parte}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Publicações ──────────────────────────────────────────────────────── */}
      {publicacoes && publicacoes.length > 0 && (
        <div className="bg-white border border-[#E8E3D8]">
          <div className="px-5 py-3.5 border-b border-[#F0EBE4] flex items-center gap-2">
            <Newspaper size={13} className="text-[#C49557]" strokeWidth={1.5} />
            <h2 className="text-[11px] tracking-[0.1em] uppercase text-[#5A5A70] font-medium">
              Publicações recentes
            </h2>
          </div>
          <div className="divide-y divide-[#F5F2EE]">
            {publicacoes.map(pub => (
              <div key={pub.id} className="px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-[#C49557] tracking-[0.1em] uppercase font-medium">
                    {TIPO_PUB_LABELS[pub.tipo_publicacao] ?? pub.tipo_publicacao}
                  </span>
                  {pub.data_publicacao && (
                    <span className="text-[10px] text-[#9CA3AF]">
                      {new Date(pub.data_publicacao).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
                {pub.resumo && (
                  <p className="text-[12px] text-[#5A5A70] leading-relaxed">{pub.resumo}</p>
                )}
                {pub.prazo_detectado && pub.prazo_data && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <AlertTriangle size={11} className="text-amber-600" />
                    <p className="text-[11px] text-amber-700 font-medium">
                      Prazo: {new Date(pub.prazo_data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
