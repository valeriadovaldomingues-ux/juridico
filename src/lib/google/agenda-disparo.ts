import { after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { criarCalendario, googleAgendaConfigurado } from './calendar'
import { sincronizarAgendaGoogle } from './agenda-sync'

/**
 * Pede a sincronização com o Google Agenda DEPOIS de responder ao usuário (não atrasa a tela). Não faz nada se o Google não
 * estiver configurado, e qualquer erro só vai para o log — o robô de 30 min refaz a tentativa.
 */
export function sincronizarGoogleEmSegundoPlano(): void {
  if (!googleAgendaConfigurado()) return
  try {
    after(async () => {
      try { await sincronizarAgendaGoogle(createServiceClient(), criarCalendario(), { desde: process.env.GOOGLE_AGENDA_SYNC_DESDE, limite: 10 }) }
      catch (e) { console.warn('[agenda-google] sincronização falhou:', e instanceof Error ? e.message : e) }
    })
  } catch { /* fora de uma requisição (testes): ignora */ }
}
