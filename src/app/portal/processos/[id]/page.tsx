import { createClient } from '@/lib/supabase/server'
import { notFound }     from 'next/navigation'
import { isUUID }       from '@/lib/portal/validate'
import Link             from 'next/link'
import { ArrowLeft, Scale, Users, CalendarDays, FileText, ArrowRight } from 'lucide-react'
import ProcessStatusBadge from '../../_components/ProcessStatusBadge'
import TimelineItem       from '../../_components/TimelineItem'

const TIPO_PARTE_LABELS: Record<string, string> = {
  autor: 'Autor', reu: 'Réu', terceiro: 'Terceiro', outro: 'Outro',
}

const AREA_LABELS: Record<string, string> = {
  civil: 'Cível', trabalhista: 'Trabalhista', criminal: 'Criminal',
  tributario: 'Tributário', previdenciario: 'Previdenciário',
  administrativo: 'Administrativo', familia: 'Família',
  empresarial: 'Empresarial', outro: 'Outro',
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
  // EXCLUÍDOS: observacoes (estratégico), valor_causa (política pendente),
  //            advogado_responsavel_id (interno)
  const { data: processo } = await supabase
    .from('processos')
    .select('id, numero_processo, titulo, area_direito, status, fase, tribunal, vara, data_distribuicao')
    .eq('id', id)
    .eq('cliente_id', pc.cliente_id)
    .eq('visivel_cliente', true)
    .single()

  if (!processo) notFound()

  const hoje = new Date().toISOString().split('T')[0]

  // Queries em paralelo — partes, publicações, audiências e prazos futuros
  const [
    { data: partes },
    { data: publicacoes },
    { data: audiencias },
    { data: prazos },
    { data: documentos },
  ] = await Promise.all([
    // EXCLUÍDOS: documento (CPF/CNPJ — LGPD), observacoes (notas internas)
    supabase.from('partes_processo')
      .select('id, pessoa_nome, tipo_parte')
      .eq('processo_id', id),

    // EXCLUÍDOS: texto_publicacao, hash, status (workflow interno), advogado_monitorado_id,
    //            oab_pesquisada, termo_encontrado, origem
    supabase.from('publicacoes')
      .select('id, tipo_publicacao, data_publicacao, resumo, prazo_detectado, prazo_data, audiencia_detectada, audiencia_data')
      .eq('processo_id', id)
      .order('data_publicacao', { ascending: false })
      .limit(10),

    // Próximas audiências liberadas
    supabase.from('agenda_items')
      .select('id, titulo, tipo, data_inicio, hora_inicio')
      .eq('processo_id', id)
      .eq('visivel_cliente', true)
      .gte('data_inicio', hoje)
      .order('data_inicio', { ascending: true })
      .limit(5),

    // Prazos pendentes liberados
    supabase.from('prazos')
      .select('id, titulo, tipo, data_final, prioridade')
      .eq('processo_id', id)
      .eq('visivel_cliente', true)
      .eq('status', 'pendente')
      .gte('data_final', hoje)
      .order('data_final', { ascending: true })
      .limit(5),

    // Documentos liberados vinculados ao processo
    supabase.from('doc_gerados')
      .select('id, titulo, created_at')
      .eq('processo_id', id)
      .eq('liberado_cliente', true)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  // Monta timeline em linguagem amigável, sem juridiquês
  type TLEntry = {
    id:    string
    data:  string | null
    tipo:  'audiencia' | 'prazo' | 'publicacao' | 'documento' | 'distribuicao'
    texto: string
    sub?:  string
    alerta: boolean
  }

  const tlEntries: TLEntry[] = []

  // Distribuição como primeiro evento
  if (processo.data_distribuicao) {
    tlEntries.push({
      id:     'dist',
      data:   processo.data_distribuicao,
      tipo:   'distribuicao',
      texto:  'Processo distribuído',
      sub:    processo.tribunal ?? undefined,
      alerta: false,
    })
  }

  // Publicações recentes
  ;(publicacoes ?? []).forEach(pub => {
    const TIPO_AMIGAVEL: Record<string, string> = {
      intimacao:   'Seu processo recebeu uma intimação.',
      publicacao:  'Nova publicação no processo.',
      despacho:    'Novo despacho no processo.',
      sentenca:    'Uma sentença foi proferida no seu processo.',
      acordao:     'O recurso foi julgado.',
      outro:       'Novo andamento no processo.',
    }
    tlEntries.push({
      id:     pub.id,
      data:   pub.data_publicacao,
      tipo:   'publicacao',
      texto:  pub.resumo ?? TIPO_AMIGAVEL[pub.tipo_publicacao] ?? 'Novo andamento no processo.',
      alerta: pub.prazo_detectado && !!pub.prazo_data,
    })
  })

  // Audiências e compromissos
  ;(audiencias ?? []).forEach(a => {
    const TIPOS: Record<string, string> = {
      audiencia:            'Audiência agendada.',
      audiencia_processual: 'Audiência agendada.',
      reuniao:              'Reunião agendada com o escritório.',
      diligencia:           'Diligência agendada.',
      outro:                a.titulo,
    }
    tlEntries.push({
      id:     a.id,
      data:   a.data_inicio,
      tipo:   'audiencia',
      texto:  TIPOS[a.tipo] ?? a.titulo,
      sub:    a.hora_inicio ? `Às ${String(a.hora_inicio).slice(0, 5)}h` : undefined,
      alerta: false,
    })
  })

  // Prazos
  ;(prazos ?? []).forEach(p => {
    tlEntries.push({
      id:     p.id,
      data:   p.data_final,
      tipo:   'prazo',
      texto:  p.titulo,
      alerta: p.prioridade === 'urgente' || p.prioridade === 'alta',
    })
  })

  // Documentos disponíveis
  ;(documentos ?? []).forEach(d => {
    tlEntries.push({
      id:     d.id,
      data:   d.created_at,
      tipo:   'documento',
      texto:  `Documento disponibilizado: ${d.titulo}`,
      alerta: false,
    })
  })

  // Ordena cronologicamente
  tlEntries.sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''))

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Voltar ────────────────────────────────────────────────────────── */}
      <Link
        href="/portal/processos"
        className="inline-flex items-center gap-1.5 text-[10px] text-[#9CA3AF] hover:text-[#C49557] tracking-[0.1em] uppercase transition-colors duration-200"
      >
        <ArrowLeft size={11} />
        Processos
      </Link>

      {/* ── Cabeçalho ────────────────────────────────────────────────────── */}
      <div className="bg-[#0C1B2A] px-6 py-7 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C49557]/40 to-transparent" />

        <div className="flex items-start gap-4">
          <div className="w-10 h-10 border border-[#C49557]/30 flex items-center justify-center shrink-0 mt-0.5">
            <Scale size={16} className="text-[#C49557]" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h1
              className="text-white text-[20px] sm:text-[22px] leading-snug tracking-tight"
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
          <ProcessStatusBadge status={processo.status} />
        </div>

        {/* Metadados */}
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 mt-6">
          {([
            ['Área',         AREA_LABELS[processo.area_direito] ?? processo.area_direito],
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

      {/* ── Atalhos contextuais ──────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {(audiencias?.length ?? 0) + (prazos?.length ?? 0) > 0 && (
          <Link
            href={`/portal/agenda`}
            className="inline-flex items-center gap-1.5 text-[10px] text-[#6B7280] border border-[#E8E3D8] px-3 py-1.5 hover:border-[#C49557]/40 hover:text-[#C49557] transition-all duration-150 tracking-wide uppercase"
          >
            <CalendarDays size={11} />
            Ver agenda
            <ArrowRight size={10} className="text-[#C5C0B8]" />
          </Link>
        )}
        {(documentos?.length ?? 0) > 0 && (
          <Link
            href="/portal/documentos"
            className="inline-flex items-center gap-1.5 text-[10px] text-[#6B7280] border border-[#E8E3D8] px-3 py-1.5 hover:border-[#C49557]/40 hover:text-[#C49557] transition-all duration-150 tracking-wide uppercase"
          >
            <FileText size={11} />
            Documentos disponíveis ({documentos?.length})
            <ArrowRight size={10} className="text-[#C5C0B8]" />
          </Link>
        )}
      </div>

      {/* ── Grid: Timeline + Partes ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Timeline */}
        <div className="lg:col-span-3">
          <p className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-4">
            Andamentos
          </p>

          {tlEntries.length === 0 ? (
            <div className="bg-white border border-[#E8E3D8] px-6 py-10 text-center">
              <div className="w-px h-5 bg-[#E8E3D8] mx-auto mb-4" />
              <p className="text-[12px] text-[#9CA3AF]">Nenhum andamento disponível ainda.</p>
            </div>
          ) : (
            <div className="bg-white border border-[#E8E3D8] px-5 py-5">
              {tlEntries.map((item, i) => (
                <TimelineItem
                  key={item.id + i}
                  data={item.data}
                  titulo={item.texto}
                  subtitulo={item.sub}
                  tipo={item.tipo}
                  alerta={item.alerta}
                  last={i === tlEntries.length - 1}
                />
              ))}
            </div>
          )}
        </div>

        {/* Partes */}
        <div className="lg:col-span-2">
          <p className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-4">
            Partes do processo
          </p>

          {!partes?.length ? (
            <div className="bg-white border border-[#E8E3D8] px-5 py-8 text-center">
              <Users size={18} className="mx-auto text-[#E8E3D8] mb-2" strokeWidth={1} />
              <p className="text-[11px] text-[#9CA3AF]">Partes não informadas.</p>
            </div>
          ) : (
            <div className="bg-white border border-[#E8E3D8] divide-y divide-[#F5F2EE]">
              {partes.map(p => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-[12px] text-[#1C1C2E] font-medium">{p.pessoa_nome}</span>
                  <span className="text-[9px] text-[#9CA3AF] border border-[#E8E3D8] px-1.5 py-0.5 tracking-wide uppercase shrink-0 ml-2">
                    {TIPO_PARTE_LABELS[p.tipo_parte] ?? p.tipo_parte}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  )
}
