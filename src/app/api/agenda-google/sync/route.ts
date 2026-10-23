import { NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createServiceClient } from '@/lib/supabase/service'
import { criarCalendario, googleAgendaConfigurado } from '@/lib/google/calendar'
import { sincronizarAgendaGoogle } from '@/lib/google/agenda-sync'

// POST — dispara a sincronização na hora (a tela da agenda chama depois de salvar). Sem Google configurado, responde "desativado".
export const maxDuration = 60

export async function POST() {
  const auth = await apiGuard(['administrativo', 'advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth
  if (!googleAgendaConfigurado()) return NextResponse.json({ desativado: 'Google Agenda não configurado' })
  try {
    return NextResponse.json(await sincronizarAgendaGoogle(createServiceClient(), criarCalendario(), { desde: process.env.GOOGLE_AGENDA_SYNC_DESDE, limite: 10 }))
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : 'Erro na sincronização' }, { status: 500 })
  }
}
