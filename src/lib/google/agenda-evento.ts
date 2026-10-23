// Monta o evento do Google Agenda (pedvprazos@gmail.com) a partir de um compromisso do PEDV, nas regras do escritório:
//  • Prazo: título "PRAZO TRABALHISTA - Cliente x Parte - nº - ato" (cível: "PRAZO! ATO - Cliente x Parte - nº"), na madrugada do
//    dia do prazo, 10 min, começando em :00, :20 ou :40, sem cor (roxo padrão). Nunca 1 hora.
//  • Audiência/perícia: horário real, 1 hora, amarelo (colorId 5), local/link no campo location.
// Funções puras (sem rede) — a conversa com o Google fica em calendar.ts / agenda-sync.ts.

import { createHash } from 'node:crypto'

export const FUSO = 'America/Sao_Paulo'

export interface CompromissoParaGoogle {
  id: string
  titulo: string
  tipo: string                 // 'prazo' | 'audiencia' | ...
  data_inicio: string          // AAAA-MM-DD
  hora_inicio?: string | null  // HH:MM[:SS]
  prazo_final?: string | null
  descricao?: string | null
  opposing_party_name?: string | null
  local?: string | null
}

export interface ContextoProcesso {
  numero_processo?: string | null
  area_direito?: string | null
  cliente?: string | null
  parteContraria?: string | null
}

export interface EventoGoogle {
  summary: string
  description: string
  location?: string
  colorId?: string
  /** Início/fim no formato do Google (dateTime com fuso) */
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  /** Para o prazo, o dia e a duração; o horário é escolhido na hora de criar (depende do que já existe no dia). */
  modo: 'prazo' | 'audiencia'
  dia: string
  duracaoMin: number
}

const trabalhista = (c: ContextoProcesso) => /trabalh/i.test(c.area_direito ?? '')

/** Só prazos e audiências/perícias vão ao Google (tarefas comuns e lançamentos de horas ficam de fora). */
export function tipoVaiParaGoogle(tipo: string): 'prazo' | 'audiencia' | null {
  if (tipo === 'prazo' || tipo === 'prazo_processual') return 'prazo'
  if (tipo === 'audiencia' || tipo === 'pericia') return 'audiencia'
  return null
}

export function tituloEvento(item: CompromissoParaGoogle, ctx: ContextoProcesso): string {
  const modo = tipoVaiParaGoogle(item.tipo)
  const partes = [ctx.cliente, item.opposing_party_name || ctx.parteContraria].filter(Boolean).join(' x ')
  const numero = ctx.numero_processo ?? ''
  const ato = item.titulo.trim()
  if (modo === 'audiencia') {
    return [trabalhista(ctx) ? 'AUDIÊNCIA TRABALHISTA' : 'AUDIÊNCIA', partes, numero, ato].filter(Boolean).join(' - ')
  }
  if (trabalhista(ctx)) return ['PRAZO TRABALHISTA', partes, numero, ato].filter(Boolean).join(' - ')
  return [`PRAZO! ${ato.toUpperCase()}`, partes, numero].filter(Boolean).join(' - ')
}

/** Primeiro link ou linha "Local: …" da descrição (o PEDV não tem campo de local separado). */
export function extrairLocal(item: Pick<CompromissoParaGoogle, 'local' | 'descricao'>): string | undefined {
  if (item.local?.trim()) return item.local.trim()
  const d = item.descricao ?? ''
  const url = /https?:\/\/\S+/.exec(d)
  if (url) return url[0].replace(/[).,;]+$/, '')
  const linha = /^\s*(?:local|endere[cç]o|sala virtual)\s*[:\-]\s*(.+)$/im.exec(d)
  return linha ? linha[1].trim() : undefined
}

const hhmm = (h: string | null | undefined) => (h ? h.slice(0, 5) : null)

function somarMin(hora: string, min: number): string {
  const total = Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5)) + min
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Evento de AUDIÊNCIA/PERÍCIA: horário real (obrigatório), 1 hora, amarelo. Prazo: devolve só dia e duração. */
export function montarEvento(item: CompromissoParaGoogle, ctx: ContextoProcesso): EventoGoogle | { erro: string } {
  const modo = tipoVaiParaGoogle(item.tipo)
  if (!modo) return { erro: 'Só prazos e audiências/perícias vão para o Google Agenda.' }
  const summary = tituloEvento(item, ctx)
  const description = (item.descricao ?? '').trim()
  if (modo === 'audiencia') {
    const hora = hhmm(item.hora_inicio)
    if (!hora) return { erro: 'Audiência sem horário: informe a hora para criar o evento.' }
    const local = extrairLocal(item)
    return {
      summary, description, ...(local ? { location: local } : {}), colorId: '5', modo, dia: item.data_inicio, duracaoMin: 60,
      start: { dateTime: `${item.data_inicio}T${hora}:00`, timeZone: FUSO },
      end: { dateTime: `${item.data_inicio}T${somarMin(hora, 60)}:00`, timeZone: FUSO },
    }
  }
  const dia = item.prazo_final || item.data_inicio
  return {
    summary, description, modo, dia, duracaoMin: 10,
    // preenchido por escolherHorarioPrazo()
    start: { dateTime: `${dia}T00:00:00`, timeZone: FUSO }, end: { dateTime: `${dia}T00:10:00`, timeZone: FUSO },
  }
}

export interface Ocupado { inicio: string; fim: string } // HH:MM no dia

const min = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5))

/**
 * Horário do PRAZO na madrugada: início em :00, :20 ou :40, 10 min de duração, com folga de pelo menos 5 min dos eventos
 * já existentes no dia. Procura de 00:00 em diante (até 06:00).
 */
export function escolherHorarioPrazo(ocupados: Ocupado[], duracaoMin = 10, folgaMin = 5): { inicio: string; fim: string } | null {
  for (let t = 0; t < 6 * 60; t += 20) {
    const ini = t
    const fim = t + duracaoMin
    const conflita = ocupados.some(o => ini < min(o.fim) + folgaMin && fim + folgaMin > min(o.inicio))
    if (!conflita) {
      const f = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
      return { inicio: f(ini), fim: f(fim) }
    }
  }
  return null
}

/** Impressão digital do que vai para o Google: se mudar, o evento é atualizado. */
export function hashEvento(e: Pick<EventoGoogle, 'summary' | 'description' | 'location' | 'dia' | 'modo'> & { hora?: string | null }): string {
  return createHash('sha1').update(JSON.stringify([e.summary, e.description, e.location ?? '', e.dia, e.modo, e.modo === 'audiencia' ? e.hora ?? '' : ''])).digest('hex').slice(0, 16)
}

/** O evento já existe no Google? (mesmo dia e mesmo número de processo no título ou na descrição) */
export function eventoJaExiste(existentes: { id?: string; summary?: string; description?: string }[], numeroProcesso: string | null | undefined): { id: string } | null {
  const dig = (numeroProcesso ?? '').replace(/\D/g, '')
  if (dig.length < 15) return null
  const achado = existentes.find(e => `${e.summary ?? ''} ${e.description ?? ''}`.replace(/\D/g, '').includes(dig))
  return achado?.id ? { id: achado.id } : null
}
