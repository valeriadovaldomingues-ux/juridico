import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { isUUID } from '@/lib/portal/validate'
import { createServiceClient } from '@/lib/supabase/service'
import { criarCalendario, googleAgendaConfigurado } from '@/lib/google/calendar'
import { enviarCompromissoAoGoogle } from '@/lib/google/agenda-sync'

// POST { id } — envia UM compromisso ao Google Agenda (revisão item a item: compromissos antigos só vão assim).
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await apiGuard(['advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth
  if (!googleAgendaConfigurado()) return NextResponse.json({ error: 'Google Agenda ainda não configurado.' }, { status: 503 })
  const body = await req.json().catch(() => null)
  const id = String(body?.id ?? '')
  if (!isUUID(id)) return NextResponse.json({ error: 'Compromisso inválido.' }, { status: 400 })
  const r = await enviarCompromissoAoGoogle(createServiceClient(), criarCalendario(), id)
  return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.erro }, { status: 400 })
}
