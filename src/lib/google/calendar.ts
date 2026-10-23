import { createSign } from 'node:crypto'
import type { Calendario, EventoExistente } from './agenda-sync'
import type { EventoGoogle } from './agenda-evento'

// Cliente mínimo do Google Calendar (API REST) com conta de serviço — sem SDK. A agenda pedvprazos@gmail.com precisa estar
// compartilhada com o e-mail da conta de serviço ("Fazer alterações em eventos").
// Variáveis: GOOGLE_CALENDAR_SA_JSON (JSON da chave), GOOGLE_CALENDAR_ID (padrão pedvprazos@gmail.com).

type Env = Record<string, string | undefined>
const ESCOPO = 'https://www.googleapis.com/auth/calendar'
const base64url = (b: Buffer | string) => Buffer.from(b).toString('base64url')

export function googleAgendaConfigurado(env: Env = process.env): boolean {
  return !!env.GOOGLE_CALENDAR_SA_JSON
}

let cache: { token: string; expira: number } | null = null

async function tokenAcesso(env: Env): Promise<string> {
  if (cache && cache.expira > Date.now() + 60_000) return cache.token
  const sa = JSON.parse(env.GOOGLE_CALENDAR_SA_JSON ?? '{}') as { client_email?: string; private_key?: string }
  if (!sa.client_email || !sa.private_key) throw new Error('GOOGLE_CALENDAR_SA_JSON inválido (faltam client_email/private_key).')
  const agora = Math.floor(Date.now() / 1000)
  const cab = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const corpo = base64url(JSON.stringify({ iss: sa.client_email, scope: ESCOPO, aud: 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600 }))
  const assinatura = createSign('RSA-SHA256').update(`${cab}.${corpo}`).sign(sa.private_key.replace(/\\n/g, '\n'))
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${cab}.${corpo}.${base64url(assinatura)}` }),
  })
  const j = await res.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error_description?: string }
  if (!res.ok || !j.access_token) throw new Error(`Google recusou a conta de serviço: ${j.error_description ?? res.status}`)
  cache = { token: j.access_token, expira: Date.now() + (j.expires_in ?? 3600) * 1000 }
  return j.access_token
}

export function criarCalendario(env: Env = process.env): Calendario {
  const id = encodeURIComponent(env.GOOGLE_CALENDAR_ID || 'pedvprazos@gmail.com')
  const url = (p = '') => `https://www.googleapis.com/calendar/v3/calendars/${id}/events${p}`
  async function chamar(metodo: string, u: string, corpo?: unknown) {
    const res = await fetch(u, { method: metodo, headers: { Authorization: `Bearer ${await tokenAcesso(env)}`, 'content-type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined })
    if (metodo === 'DELETE' && (res.status === 404 || res.status === 410)) return null
    if (!res.ok) {
      const j = await res.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(`Google Agenda (${res.status}): ${j.error?.message ?? 'erro'}`)
    }
    return res.status === 204 ? null : res.json()
  }
  const corpoDe = (e: EventoGoogle) => ({ summary: e.summary, description: e.description, ...(e.location ? { location: e.location } : {}), ...(e.colorId ? { colorId: e.colorId } : {}), start: e.start, end: e.end })
  return {
    async eventosDoDia(dia: string): Promise<EventoExistente[]> {
      const q = new URLSearchParams({ timeMin: `${dia}T00:00:00-03:00`, timeMax: `${dia}T23:59:59-03:00`, singleEvents: 'true', maxResults: '250', timeZone: 'America/Sao_Paulo' })
      const j = await chamar('GET', `${url()}?${q}`) as { items?: EventoExistente[] }
      return j.items ?? []
    },
    async criar(e) { const j = await chamar('POST', url(), corpoDe(e)) as { id: string }; return j.id },
    async atualizar(idEvento, e) { await chamar('PATCH', url(`/${encodeURIComponent(idEvento)}`), corpoDe(e)) },
    async apagar(idEvento) { await chamar('DELETE', url(`/${encodeURIComponent(idEvento)}`)) },
  }
}
