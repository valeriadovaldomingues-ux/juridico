import { createClient }      from '@/lib/supabase/server'
import Link                   from 'next/link'
import { Scale, CalendarDays, FileText, MessageSquare, ArrowRight, Clock } from 'lucide-react'
import PortalStatCard          from './_components/PortalStatCard'
import TimelineItem            from './_components/TimelineItem'
import ProcessStatusBadge      from './_components/ProcessStatusBadge'

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
function fmtData(iso: string) {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  return `${String(d.getDate()).padStart(2,'0')} ${MESES[d.getMonth()]}`
}

export default async function PortalDashboard() {
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: portalCliente } = user
    ? await supabase
        .from('portal_clientes')
        .select('cliente_id, clientes(nome)')
        .eq('auth_user_id', user.id).eq('ativo', true)
        .single()
    : { data: null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nomeCliente: string = (portalCliente as any)?.clientes?.nome
    ?? (portalCliente as any)?.clientes?.[0]?.nome ?? 'Cliente'
  const primeiroNome = nomeCliente.split(' ')[0]
  const clienteId    = (portalCliente as any)?.cliente_id as string | undefined

  if (!clienteId) return <DashboardVazio primeiroNome={primeiroNome} />

  const hoje = new Date().toISOString().split('T')[0]

  // ── Queries em paralelo ────────────────────────────────────────────────
  const [
    { data: processos },
    { data: processoIds },
    { data: mensagensNaoLidas },
    { data: documentos },
  ] = await Promise.all([
    // Processos ativos liberados
    supabase.from('processos')
      .select('id, numero_processo, titulo, status, area_direito, created_at')
      .eq('cliente_id', clienteId).eq('visivel_cliente', true)
      .order('created_at', { ascending: false }),

    // IDs dos processos visíveis (para queries dependentes)
    supabase.from('processos')
      .select('id')
      .eq('cliente_id', clienteId).eq('visivel_cliente', true),

    // Mensagens não lidas do escritório
    supabase.from('portal_mensagens')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', clienteId)
      .eq('autor_tipo', 'escritorio')
      .eq('lida', false),

    // Documentos liberados
    supabase.from('documentos')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', clienteId).eq('liberado_cliente', true),
  ])

  const ids = (processoIds ?? []).map(p => p.id)

  // Queries dependentes dos IDs dos processos
  const [
    { data: proximasAudiencias },
    { data: prazosProximos },
    { data: publicacoesRecentes },
  ] = ids.length > 0
    ? await Promise.all([
        supabase.from('agenda_items')
          .select('id, titulo, tipo, data_inicio, hora_inicio, processo_id, processo:processos(numero_processo, titulo)')
          .in('processo_id', ids).eq('visivel_cliente', true)
          .gte('data_inicio', hoje)
          .order('data_inicio', { ascending: true }).limit(3),

        supabase.from('prazos')
          .select('id, titulo, tipo, data_final, prioridade, processo_id, processo:processos(numero_processo, titulo)')
          .in('processo_id', ids).eq('visivel_cliente', true).eq('status', 'pendente')
          .gte('data_final', hoje)
          .order('data_final', { ascending: true }).limit(5),

        supabase.from('publicacoes')
          .select('id, tipo_publicacao, data_publicacao, resumo, prazo_detectado, prazo_data, processo_id')
          .in('processo_id', ids)
          .order('data_publicacao', { ascending: false }).limit(5),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  // Contagens para os stat cards
  const nProcessos    = (processos ?? []).length
  const nAudiencias   = (proximasAudiencias ?? []).length
  const nPrazos       = (prazosProximos ?? []).length
  const nMsgsNaoLidas = (mensagensNaoLidas as unknown as { count: number })?.count ?? 0
  const nDocs         = (documentos as unknown as { count: number })?.count ?? 0

  // Timeline — monta a partir de audiências, prazos e publicações recentes
  type TLItem = {
    id:    string
    data:  string | null
    tipo:  'audiencia' | 'prazo' | 'publicacao'
    texto: string
    sub:   string
    alerta: boolean
  }

  const tlItems: TLItem[] = [
    ...(proximasAudiencias ?? []).map(a => ({
      id:     a.id,
      data:   a.data_inicio,
      tipo:   'audiencia' as const,
      texto:  a.titulo,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sub:    (a as any).processo?.numero_processo ?? '',
      alerta: false,
    })),
    ...(prazosProximos ?? []).slice(0, 3).map(p => ({
      id:     p.id,
      data:   p.data_final,
      tipo:   'prazo' as const,
      texto:  p.titulo,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sub:    (p as any).processo?.numero_processo ?? '',
      alerta: p.prioridade === 'urgente' || p.prioridade === 'alta',
    })),
    ...(publicacoesRecentes ?? []).slice(0, 3).map(pub => ({
      id:     pub.id,
      data:   pub.data_publicacao,
      tipo:   'publicacao' as const,
      texto:  pub.resumo ?? 'Nova publicação no processo',
      sub:    '',
      alerta: pub.prazo_detectado && !!pub.prazo_data,
    })),
  ].sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''))

  const processosAtivos = (processos ?? []).filter(p => p.status === 'ativo')

  return (
    <div className="space-y-8">

      {/* ── Saudação ──────────────────────────────────────────────────────── */}
      <div className="bg-[#0C1B2A] px-6 sm:px-8 py-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C49557]/50 to-transparent" />

        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-[#C49557] text-[10px] tracking-[0.2em] uppercase mb-2">
              Portal do Cliente
            </p>
            <h1
              className="text-white text-[32px] sm:text-[38px] leading-none tracking-tight"
              style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}
            >
              {primeiroNome}
            </h1>
            <p className="text-white/40 text-[13px] mt-2 leading-relaxed">
              {nProcessos > 0
                ? `${nProcessos} processo${nProcessos !== 1 ? 's' : ''} acompanhado${nProcessos !== 1 ? 's' : ''} pelo escritório.`
                : 'Bem-vindo ao seu portal jurídico.'
              }
            </p>
          </div>
          <span className="text-white/10 text-[11px] tracking-[0.15em] uppercase self-start mt-2">
            P&amp;V · MMV
          </span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-[#C49557]/30 via-transparent to-transparent" />
      </div>

      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <PortalStatCard icon={Scale}         label="Processos"        value={nProcessos}    href="/portal/processos"  accent />
        <PortalStatCard icon={CalendarDays}  label="Próx. audiências" value={nAudiencias}   href="/portal/agenda"     accent={nAudiencias > 0} />
        <PortalStatCard icon={Clock}         label="Prazos pendentes" value={nPrazos}        href="/portal/agenda"     alert={nPrazos > 0} />
        <PortalStatCard icon={MessageSquare} label="Msgs não lidas"   value={nMsgsNaoLidas} href="/portal/mensagens"  alert={nMsgsNaoLidas > 0} />
      </div>

      {/* ── Linha principal: timeline + processos ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Timeline de atividades recentes */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase">Próximas atividades</p>
            <Link href="/portal/agenda" className="text-[10px] text-[#C49557] hover:text-[#A8803D] tracking-wide transition-colors">
              Ver agenda →
            </Link>
          </div>

          {tlItems.length === 0 ? (
            <div className="bg-white border border-[#E8E3D8] px-6 py-10 text-center">
              <div className="w-px h-5 bg-[#E8E3D8] mx-auto mb-4" />
              <p className="text-[12px] text-[#9CA3AF]">Nenhuma atividade próxima.</p>
            </div>
          ) : (
            <div className="bg-white border border-[#E8E3D8] px-5 py-5">
              {tlItems.map((item, i) => (
                <TimelineItem
                  key={item.id}
                  data={item.data}
                  titulo={item.texto}
                  subtitulo={item.sub || undefined}
                  tipo={item.tipo}
                  alerta={item.alerta}
                  last={i === tlItems.length - 1}
                />
              ))}
              <div className="mt-2 pt-3 border-t border-[#F0EBE4]">
                <Link
                  href="/portal/agenda"
                  className="flex items-center gap-1.5 text-[10px] text-[#C49557] hover:text-[#A8803D] tracking-[0.08em] uppercase transition-colors"
                >
                  Ver agenda completa <ArrowRight size={10} />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Lista de processos */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase">Meus processos</p>
            {nProcessos > 3 && (
              <Link href="/portal/processos" className="text-[10px] text-[#C49557] hover:text-[#A8803D] tracking-wide transition-colors">
                Ver todos →
              </Link>
            )}
          </div>

          {processosAtivos.length === 0 ? (
            <div className="bg-white border border-[#E8E3D8] px-5 py-8 text-center">
              <Scale size={20} className="mx-auto text-[#E8E3D8] mb-3" strokeWidth={1} />
              <p className="text-[12px] text-[#9CA3AF]">Nenhum processo ativo.</p>
            </div>
          ) : (
            <div className="bg-white border border-[#E8E3D8] divide-y divide-[#F5F2EE]">
              {processosAtivos.slice(0, 4).map(p => (
                <Link
                  key={p.id}
                  href={`/portal/processos/${p.id}`}
                  className="relative flex items-start gap-3 px-4 py-3.5 hover:bg-[#FDFAF7] transition-colors duration-200 group overflow-hidden"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#C49557] scale-y-0 group-hover:scale-y-100 origin-center transition-transform duration-200" />
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-[12px] font-medium text-[#1C1C2E] truncate leading-snug">{p.titulo}</p>
                    {p.numero_processo && (
                      <p className="text-[10px] text-[#9CA3AF] font-mono mt-0.5 tracking-wide">{p.numero_processo}</p>
                    )}
                  </div>
                  <ProcessStatusBadge status={p.status} size="sm" />
                </Link>
              ))}
              {nProcessos > 4 && (
                <Link href="/portal/processos" className="flex items-center justify-center gap-1 px-4 py-2.5 text-[10px] text-[#C49557] hover:bg-[#FDFAF7] tracking-[0.08em] uppercase transition-colors">
                  Ver todos ({nProcessos}) <ArrowRight size={10} />
                </Link>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ── Documentos recentes ───────────────────────────────────────────── */}
      {nDocs > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase">
              Documentos disponíveis
            </p>
            <Link href="/portal/documentos" className="text-[10px] text-[#C49557] hover:text-[#A8803D] tracking-wide transition-colors">
              Ver todos →
            </Link>
          </div>
          <div className="bg-white border border-[#E8E3D8] px-5 py-4">
            <div className="flex items-center gap-3">
              <FileText size={15} className="text-[#C49557]" strokeWidth={1.5} />
              <p className="text-[13px] text-[#1C1C2E]">
                {nDocs} arquivo{nDocs !== 1 ? 's' : ''} disponíve{nDocs !== 1 ? 'is' : 'l'} para download.
              </p>
              <Link
                href="/portal/documentos"
                className="ml-auto flex items-center gap-1.5 text-[10px] text-white bg-[#C49557] hover:bg-[#A8803D] px-3 py-1.5 tracking-[0.1em] uppercase transition-colors duration-200"
              >
                <FileText size={10} /> Acessar
              </Link>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ── Dashboard quando ainda não há vínculo portal_clientes ──────────────────

function DashboardVazio({ primeiroNome }: { primeiroNome: string }) {
  return (
    <div className="space-y-8">
      <div className="bg-[#0C1B2A] px-6 sm:px-8 py-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C49557]/50 to-transparent" />
        <p className="text-[#C49557] text-[10px] tracking-[0.2em] uppercase mb-2">Portal do Cliente</p>
        <h1
          className="text-white text-[32px] leading-none tracking-tight"
          style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}
        >
          {primeiroNome}
        </h1>
        <p className="text-white/40 text-[13px] mt-2">
          Bem-vindo. Seu acesso está sendo configurado pelo escritório.
        </p>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-[#C49557]/30 via-transparent to-transparent" />
      </div>
      <div className="bg-white border border-[#E8E3D8] px-8 py-12 text-center">
        <div className="w-px h-6 bg-gradient-to-b from-transparent to-[#E8E3D8] mx-auto mb-5" />
        <Scale size={20} className="mx-auto text-[#C5C0B8] mb-4" strokeWidth={1} />
        <p className="text-[13px] text-[#6B7280] font-medium mb-1">Vínculo em configuração</p>
        <p className="text-[11px] text-[#9CA3AF] leading-relaxed max-w-[240px] mx-auto">
          Em breve você poderá acompanhar seus processos e documentos aqui.
        </p>
        <div className="w-8 h-px bg-[#C49557]/20 mx-auto mt-6" />
      </div>
    </div>
  )
}
