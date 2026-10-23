import { createClient } from '@supabase/supabase-js'
import { criarCalendario, googleAgendaConfigurado } from '@/lib/google/calendar'
import { sincronizarAgendaGoogle } from '@/lib/google/agenda-sync'

// GET — sincroniza prazos/audiências do PEDV com o Google Agenda (rede de segurança a cada ~30 min; ver o workflow).
export const maxDuration = 120

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo || (request.headers.get('authorization') ?? '') !== `Bearer ${segredo}`) return Response.json({ erro: 'Não autorizado' }, { status: 401 })
  if (!googleAgendaConfigurado()) return Response.json({ ok: true, desativado: 'GOOGLE_CALENDAR_SA_JSON não configurada' })
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  try {
    return Response.json(await sincronizarAgendaGoogle(db, criarCalendario(), { desde: process.env.GOOGLE_AGENDA_SYNC_DESDE }))
  } catch (e) {
    return Response.json({ erro: e instanceof Error ? e.message : 'Erro na sincronização' }, { status: 500 })
  }
}
