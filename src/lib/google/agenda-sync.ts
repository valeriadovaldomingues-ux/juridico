// Sincronização PEDV → Google Agenda (mão única). Cada compromisso de prazo/audiência vira um evento; o id do evento fica no
// compromisso (agenda_items.google_event_id) para editar e apagar depois. Nada é enviado em massa: o envio automático só vale
// para compromissos criados a partir de GOOGLE_AGENDA_SYNC_DESDE; os antigos só vão um a um (enviarCompromissoAoGoogle).

import { escolherHorarioPrazo, eventoJaExiste, hashEvento, montarEvento, tipoVaiParaGoogle, type CompromissoParaGoogle, type ContextoProcesso, type EventoGoogle, type Ocupado } from './agenda-evento'

type Db = { from: (t: string) => any }  // eslint-disable-line @typescript-eslint/no-explicit-any

export interface EventoExistente {
  id?: string
  summary?: string
  description?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
}

export interface Calendario {
  eventosDoDia(dia: string): Promise<EventoExistente[]>
  criar(e: EventoGoogle): Promise<string>
  atualizar(id: string, e: EventoGoogle): Promise<void>
  apagar(id: string): Promise<void>
}

const COLUNAS = 'id, titulo, tipo, status, data_inicio, hora_inicio, prazo_final, descricao, opposing_party_name, processo_id, cliente_id, created_at, google_event_id, google_hash'

const hhmmDe = (iso?: string) => (iso && iso.length >= 16 ? iso.slice(11, 16) : null)

function ocupadosDoDia(eventos: EventoExistente[], ignorarId?: string | null): Ocupado[] {
  const lista: Ocupado[] = []
  for (const e of eventos) {
    if (e.id && e.id === ignorarId) continue
    const ini = hhmmDe(e.start?.dateTime), fim = hhmmDe(e.end?.dateTime)
    if (ini && fim) lista.push({ inicio: ini, fim })
  }
  return lista
}

async function carregarContexto(db: Db, item: { processo_id?: string | null; cliente_id?: string | null }): Promise<ContextoProcesso> {
  const ctx: ContextoProcesso = {}
  if (item.processo_id) {
    const { data: p } = await db.from('processos').select('numero_processo, area_direito, cliente:clientes!cliente_id(nome), partes_processo(pessoa_nome, tipo_parte)').eq('id', item.processo_id).maybeSingle()
    if (p) {
      ctx.numero_processo = p.numero_processo
      ctx.area_direito = p.area_direito
      const cli = Array.isArray(p.cliente) ? p.cliente[0] : p.cliente
      ctx.cliente = cli?.nome ?? null
      const contra = (p.partes_processo ?? []).find((x: { pessoa_nome?: string; tipo_parte?: string }) => x.pessoa_nome && x.tipo_parte !== 'cliente')
      ctx.parteContraria = contra?.pessoa_nome ?? null
    }
  } else if (item.cliente_id) {
    const { data: c } = await db.from('clientes').select('nome').eq('id', item.cliente_id).maybeSingle()
    ctx.cliente = c?.nome ?? null
  }
  return ctx
}

export type ResultadoEnvio = { ok: true; acao: 'criado' | 'vinculado' | 'atualizado' | 'sem_mudanca'; eventoId: string } | { ok: false; erro: string }

/** Cria ou atualiza o evento de UM compromisso. `forcar` ignora a data de ativação (envio manual de compromisso antigo). */
export async function enviarCompromissoAoGoogle(db: Db, cal: Calendario, itemId: string): Promise<ResultadoEnvio> {
  const { data: item, error } = await db.from('agenda_items').select(COLUNAS).eq('id', itemId).maybeSingle()
  if (error) return { ok: false, erro: error.message }
  if (!item) return { ok: false, erro: 'Compromisso não encontrado.' }
  const modo = tipoVaiParaGoogle(item.tipo)
  if (!modo) return { ok: false, erro: 'Só prazos e audiências/perícias vão para o Google Agenda.' }

  const ctx = await carregarContexto(db, item)
  const base = montarEvento(item as CompromissoParaGoogle, ctx)
  if ('erro' in base) { await db.from('agenda_items').update({ google_sync_erro: base.erro }).eq('id', itemId); return { ok: false, erro: base.erro } }

  const hashAtual = hashEvento({ ...base, hora: item.hora_inicio ? String(item.hora_inicio).slice(0, 5) : null })
  if (item.google_event_id && item.google_hash === hashAtual) return { ok: true, acao: 'sem_mudanca', eventoId: item.google_event_id }

  const doDia = await cal.eventosDoDia(base.dia)
  let evento = base
  if (base.modo === 'prazo') {
    if (!item.google_event_id) {
      const ja = eventoJaExiste(doDia, ctx.numero_processo)
      if (ja) { // já está no Google: só vincula, não duplica
        await db.from('agenda_items').update({ google_event_id: ja.id, google_hash: hashAtual, google_synced_at: new Date().toISOString(), google_sync_erro: null }).eq('id', itemId)
        return { ok: true, acao: 'vinculado', eventoId: ja.id }
      }
    }
    const h = escolherHorarioPrazo(ocupadosDoDia(doDia, item.google_event_id), base.duracaoMin)
    if (!h) { const erro = 'Sem horário livre na madrugada desse dia.'; await db.from('agenda_items').update({ google_sync_erro: erro }).eq('id', itemId); return { ok: false, erro } }
    evento = { ...base, start: { dateTime: `${base.dia}T${h.inicio}:00`, timeZone: base.start.timeZone }, end: { dateTime: `${base.dia}T${h.fim}:00`, timeZone: base.end.timeZone } }
  }

  try {
    let id = item.google_event_id as string | null
    let acao: 'criado' | 'atualizado' = 'atualizado'
    if (id) await cal.atualizar(id, evento)
    else { id = await cal.criar(evento); acao = 'criado' }
    await db.from('agenda_items').update({ google_event_id: id, google_hash: hashAtual, google_synced_at: new Date().toISOString(), google_sync_erro: null }).eq('id', itemId)
    return { ok: true, acao, eventoId: id! }
  } catch (e) {
    const erro = e instanceof Error ? e.message : 'Falha ao falar com o Google.'
    await db.from('agenda_items').update({ google_sync_erro: erro.slice(0, 500) }).eq('id', itemId)
    return { ok: false, erro }
  }
}

export interface ResumoSync { criados: number; atualizados: number; vinculados: number; apagados: number; erros: number; desativado?: string }

/** Passada automática: novos (criados desde a data de ativação), editados e excluídos. Limita o lote para caber no tempo. */
export async function sincronizarAgendaGoogle(db: Db, cal: Calendario, opcoes: { desde?: string | null; limite?: number } = {}): Promise<ResumoSync> {
  const r: ResumoSync = { criados: 0, atualizados: 0, vinculados: 0, apagados: 0, erros: 0 }
  const limite = opcoes.limite ?? 30
  if (!opcoes.desde) return { ...r, desativado: 'Envio automático desligado (defina GOOGLE_AGENDA_SYNC_DESDE).' }

  const contar = (x: ResultadoEnvio) => {
    if (!x.ok) r.erros++
    else if (x.acao === 'criado') r.criados++
    else if (x.acao === 'atualizado') r.atualizados++
    else if (x.acao === 'vinculado') r.vinculados++
  }

  // 1) Novos
  const { data: novos, error: e1 } = await db.from('agenda_items').select('id').is('google_event_id', null).is('google_sync_erro', null)
    .in('tipo', ['prazo', 'prazo_processual', 'audiencia', 'pericia']).eq('status', 'pendente').gte('created_at', opcoes.desde).order('created_at').limit(limite)
  if (e1) return { ...r, erros: 1, desativado: `Banco sem as colunas do Google (rode a migration): ${e1.message}` }
  for (const n of novos ?? []) contar(await enviarCompromissoAoGoogle(db, cal, n.id))

  // 2) Editados (já no Google): recalcula e atualiza só se o conteúdo mudou
  const { data: existentes } = await db.from('agenda_items').select('id').not('google_event_id', 'is', null).eq('status', 'pendente').order('data_inicio', { ascending: false }).limit(limite)
  for (const x of existentes ?? []) { const res = await enviarCompromissoAoGoogle(db, cal, x.id); if (!(res.ok && res.acao === 'sem_mudanca')) contar(res) }

  // 3) Excluídos no PEDV (a fila é preenchida por um gatilho do banco)
  const { data: fila } = await db.from('agenda_google_exclusoes').select('id, google_event_id').order('created_at').limit(limite)
  for (const f of fila ?? []) {
    try { await cal.apagar(f.google_event_id); await db.from('agenda_google_exclusoes').delete().eq('id', f.id); r.apagados++ } catch { r.erros++ }
  }
  return r
}
