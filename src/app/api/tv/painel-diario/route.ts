import { NextResponse } from 'next/server'
import { createClient }  from '@/lib/supabase/server'
import { apiGuard }      from '@/lib/auth/api-guard'

// ── Tipos exportados ──────────────────────────────────────────────────────────

export type StatusNorm  = 'pendente' | 'em_andamento' | 'concluido' | 'atrasado' | 'cancelado' | 'reagendado'
export type UrgenciaNorm = 'critico' | 'atencao' | 'normal' | 'concluido'
export type TipoItem    = 'audiencia' | 'prazo' | 'tarefa' | 'publicacao' | 'reuniao' | 'diligencia' | 'outro'

export interface PainelItem {
  id:           string
  tipo:         TipoItem
  titulo:       string     // truncado, sem dados sensíveis
  horario:      string | null  // HH:mm
  responsavel:  string | null  // primeiro nome apenas
  processo_num: string | null  // número CNJ resumido
  status:       StatusNorm
  urgencia:     UrgenciaNorm
  area?:        string | null
}

export interface PainelDiario {
  date_br:        string   // "quinta-feira, 15 de maio de 2026"
  date_iso:       string   // "2026-05-15" em BRT
  hora_br:        string   // "14:32" em BRT
  atualizado_em:  string   // ISO completo

  blocos: {
    agora:               PainelItem[]
    prazos_do_dia:        PainelItem[]
    audiencias:           PainelItem[]
    reunioes:             PainelItem[]
    tarefas_urgentes:     PainelItem[]
    pendencias:           PainelItem[]
    atualizacoes_recentes: PainelItem[]
  }

  meta: {
    total_prazos:   number
    total_tarefas:  number
    total_atrasado: number
  }
}

// ── Helpers de timezone BRT ───────────────────────────────────────────────────

function getBRTNow(): { dateISO: string; hourMin: string; dateBR: string; nowUTC: Date } {
  const now = new Date()

  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ...opts })

  const dateParts = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const year  = dateParts.find(p => p.type === 'year')!.value
  const month = dateParts.find(p => p.type === 'month')!.value
  const day   = dateParts.find(p => p.type === 'day')!.value

  const hourMin = fmt({ hour: '2-digit', minute: '2-digit', hour12: false }).format(now)

  const dateBR = fmt({
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(now)

  return {
    dateISO: `${year}-${month}-${day}`,
    hourMin,
    dateBR,
    nowUTC: now,
  }
}

// BRT é UTC-3 (sem horário de verão desde 2019)
function brtDayBounds(dateISO: string): { start: string; end: string } {
  return {
    start: `${dateISO}T00:00:00-03:00`,
    end:   `${dateISO}T23:59:59-03:00`,
  }
}

function brtNowMinus(minutes: number, nowUTC: Date): string {
  return new Date(nowUTC.getTime() - minutes * 60_000).toISOString()
}

// ── Normalização ──────────────────────────────────────────────────────────────

function normalizeStatus(
  rawStatus: string,
  data: string | null,
  dateISO: string,
): StatusNorm {
  if (rawStatus === 'concluido') return 'concluido'
  if (rawStatus === 'cancelado') return 'cancelado'
  if (rawStatus === 'fazendo')   return 'em_andamento'
  if (data && data < dateISO && rawStatus !== 'concluido') return 'atrasado'
  return 'pendente'
}

function normalizeUrgencia(prioridade: string | null | undefined, status: StatusNorm): UrgenciaNorm {
  if (status === 'concluido') return 'concluido'
  if (prioridade === 'urgente') return 'critico'
  if (prioridade === 'alta')    return 'atencao'
  return 'normal'
}

// Trunca título removendo dados sensíveis implícitos (números longos, CPF, etc.)
function sanitizeTitulo(titulo: string): string {
  return (titulo ?? '').slice(0, 70).trim()
}

// Retorna apenas o primeiro nome para privacidade de tela
function primeiroNome(nome: string | null | undefined): string | null {
  if (!nome) return null
  return nome.split(' ')[0]
}

// Resume número do processo para exibição (apenas últimos 8 chars do CNJ)
function resumeProcessoNum(num: string | null | undefined): string | null {
  if (!num) return null
  const clean = num.replace(/\D/g, '')
  return clean.length > 7 ? `…${clean.slice(-7)}` : num
}

// ── Tipos de agenda ───────────────────────────────────────────────────────────

const AGENDA_TO_TIPO: Record<string, TipoItem> = {
  audiencia:            'audiencia',
  audiencia_processual: 'audiencia',
  reuniao:              'reuniao',
  diligencia:           'diligencia',
  prazo:                'prazo',
  prazo_processual:     'prazo',
  tarefa:               'tarefa',
  evento:               'outro',
  outro:                'outro',
}

// ── API Handler ───────────────────────────────────────────────────────────────

export async function GET() {
  const auth = await apiGuard(['gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()
  const { dateISO, hourMin, dateBR, nowUTC } = getBRTNow()
  const { start: dayStart, end: dayEnd } = brtDayBounds(dateISO)

  // Janela "Agora": ±90min do momento atual
  const agoraStart = brtNowMinus(15, nowUTC)  // 15min antes
  const agoraEnd   = new Date(nowUTC.getTime() + 90 * 60_000).toISOString()  // 90min depois

  // Publicações recentes: últimas 24h
  const pub24h = new Date(nowUTC.getTime() - 24 * 3600_000).toISOString()

  const [
    { data: agendaHoje },
    { data: prazosHoje },
    { data: tarefas },
    { data: pubRecentes },
  ] = await Promise.all([

    // Agenda do dia — sem campos sensíveis (sem descricao, observacoes)
    supabase.from('agenda_items')
      .select(`
        id, titulo, tipo, status, data_inicio, hora_inicio, prioridade,
        processo:processos(numero_processo, area_direito),
        responsavel:profiles!responsible_user_id(nome)
      `)
      .eq('data_inicio', dateISO)
      .neq('status', 'cancelado')
      .order('hora_inicio', { ascending: true, nullsFirst: false })
      .limit(30),

    // Prazos de hoje — sem descricao ou observacoes
    supabase.from('prazos')
      .select(`
        id, titulo, tipo, status, data_final, prioridade,
        processo:processos(numero_processo, area_direito),
        responsavel:profiles!responsavel_id(nome)
      `)
      .eq('data_final', dateISO)
      .neq('status', 'cancelado')
      .order('prioridade', { ascending: true })
      .limit(20),

    // Tarefas urgentes e pendências (sem descricao completa)
    supabase.from('kanban_tasks')
      .select(`
        id, titulo, status, prioridade, data, origem,
        processo:processos(numero_processo, area_direito),
        responsavel:profiles!responsavel_id(nome)
      `)
      .in('status', ['a_fazer', 'fazendo', 'com_pendencia'])
      .in('prioridade', ['urgente', 'alta', 'media'])
      .order('prioridade', { ascending: true })
      .limit(40),

    // Publicações recentes — apenas campos não sensíveis (sem texto_publicacao, hash, oab)
    supabase.from('publicacoes')
      .select(`
        id, tipo_publicacao, data_publicacao, prazo_detectado, prazo_data,
        audiencia_detectada, audiencia_data, created_at,
        processo:processos(numero_processo)
      `)
      .gte('created_at', pub24h)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  // ── Montar itens normalizados ─────────────────────────────────────────────

  const makeAgendaItem = (a: Record<string, unknown>): PainelItem => {
    const tipo  = AGENDA_TO_TIPO[(a.tipo as string) ?? 'outro'] ?? 'outro'
    const proc  = a.processo as { numero_processo?: string; area_direito?: string } | null
    const resp  = a.responsavel as { nome?: string } | null
    const status = normalizeStatus(
      a.status as string,
      a.data_inicio as string | null,
      dateISO,
    )
    return {
      id:           a.id as string,
      tipo,
      titulo:       sanitizeTitulo(a.titulo as string),
      horario:      (a.hora_inicio as string | null)?.slice(0, 5) ?? null,
      responsavel:  primeiroNome(resp?.nome),
      processo_num: resumeProcessoNum(proc?.numero_processo),
      status,
      urgencia:     normalizeUrgencia(a.prioridade as string | null, status),
      area:         proc?.area_direito ?? null,
    }
  }

  const makePrazoItem = (p: Record<string, unknown>): PainelItem => {
    const proc  = p.processo as { numero_processo?: string; area_direito?: string } | null
    const resp  = p.responsavel as { nome?: string } | null
    const status = normalizeStatus(
      p.status as string,
      p.data_final as string | null,
      dateISO,
    )
    return {
      id:           p.id as string,
      tipo:         'prazo',
      titulo:       sanitizeTitulo(p.titulo as string),
      horario:      null,
      responsavel:  primeiroNome(resp?.nome),
      processo_num: resumeProcessoNum(proc?.numero_processo),
      status,
      urgencia:     normalizeUrgencia(p.prioridade as string | null, status),
      area:         proc?.area_direito ?? null,
    }
  }

  const makeTarefaItem = (t: Record<string, unknown>): PainelItem => {
    const proc  = t.processo as { numero_processo?: string; area_direito?: string } | null
    const resp  = t.responsavel as { nome?: string } | null
    const statusRaw = t.status as string
    const data      = t.data as string | null
    const status: StatusNorm =
      statusRaw === 'com_pendencia' ? 'pendente' :
      statusRaw === 'fazendo'       ? 'em_andamento' :
      normalizeStatus(statusRaw, data, dateISO)

    return {
      id:           t.id as string,
      tipo:         'tarefa',
      titulo:       sanitizeTitulo(t.titulo as string),
      horario:      null,
      responsavel:  primeiroNome(resp?.nome),
      processo_num: resumeProcessoNum(proc?.numero_processo),
      status,
      urgencia:     normalizeUrgencia(t.prioridade as string | null, status),
      area:         proc?.area_direito ?? null,
    }
  }

  const makePubItem = (pub: Record<string, unknown>): PainelItem => {
    const proc  = pub.processo as { numero_processo?: string } | null
    const tipo_pub = pub.tipo_publicacao as string ?? 'publicacao'
    const titulos: Record<string, string> = {
      intimacao:  'Nova intimação',
      publicacao: 'Nova publicação',
      despacho:   'Novo despacho',
      sentenca:   'Sentença proferida',
      acordao:    'Acórdão publicado',
      outro:      'Nova movimentação',
    }
    return {
      id:           pub.id as string,
      tipo:         'publicacao',
      titulo:       titulos[tipo_pub] ?? 'Nova publicação',
      horario:      null,
      responsavel:  null,
      processo_num: resumeProcessoNum(proc?.numero_processo),
      status:       'pendente',
      urgencia:     (pub.prazo_detectado) ? 'atencao' : 'normal',
    }
  }

  // ── Classificar itens em blocos ───────────────────────────────────────────

  const agendaItems = (agendaHoje ?? []).map(a => makeAgendaItem(a as Record<string, unknown>))
  const prazoItems  = (prazosHoje ?? []).map(p => makePrazoItem(p as Record<string, unknown>))
  const tarefaItems = (tarefas ?? []).map(t => makeTarefaItem(t as Record<string, unknown>))
  const pubItems    = (pubRecentes ?? []).map(p => makePubItem(p as Record<string, unknown>))

  // "Agora" = agenda items com hora dentro da janela atual
  const agora = agendaItems.filter(a => {
    if (!a.horario) return false
    const [h, m] = a.horario.split(':').map(Number)
    const itemBRT = new Date(`${dateISO}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00-03:00`)
    return itemBRT >= new Date(agoraStart) && itemBRT <= new Date(agoraEnd)
  })

  const audiencias = agendaItems.filter(a => a.tipo === 'audiencia')
  const reunioes   = agendaItems.filter(a => a.tipo === 'reuniao')

  const tarefasUrgentes = tarefaItems.filter(
    t => t.urgencia === 'critico' || t.urgencia === 'atencao'
  ).slice(0, 8)

  const pendencias = tarefaItems.filter(
    t => t.status === 'pendente' && (t.urgencia === 'normal' || t.urgencia === 'atencao')
  ).slice(0, 8)

  const atualizacoesRecentes = [
    ...pubItems,
    ...prazoItems.filter(p => p.status === 'atrasado'),
  ].slice(0, 6)

  // ── Meta ──────────────────────────────────────────────────────────────────

  const totalAtrasado = [
    ...prazoItems.filter(p => p.status === 'atrasado'),
    ...tarefaItems.filter(t => t.status === 'atrasado'),
  ].length

  const payload: PainelDiario = {
    date_br:       dateBR,
    date_iso:      dateISO,
    hora_br:       hourMin,
    atualizado_em: nowUTC.toISOString(),

    blocos: {
      agora,
      prazos_do_dia:        prazoItems,
      audiencias,
      reunioes,
      tarefas_urgentes:     tarefasUrgentes,
      pendencias,
      atualizacoes_recentes: atualizacoesRecentes,
    },

    meta: {
      total_prazos:   prazoItems.length,
      total_tarefas:  tarefaItems.length,
      total_atrasado: totalAtrasado,
    },
  }

  return NextResponse.json(payload)
}
