// ─── API Route: GET /api/cron/keepalive ──────────────────────────────────────
//
// Mantém o projeto Supabase (plano gratuito) acordado: o plano pausa o projeto
// depois de ~7 dias sem atividade, o que derruba o login (aparece como "senha
// errada"). Pausas aconteceram em 22/09 e 07/10/2026.
//
// Por que existe separado dos outros crons: /api/cron/trello e /api/cron/inpi-rpi
// recusam a chamada (401) ANTES de tocar no banco se o CRON_SECRET não bater —
// e a sincronização do INPI nunca chegou a rodar (inpi_sync_state.ultima_execucao
// segue nulo). Esta rota não exige segredo: só faz uma contagem leve com a chave
// pública (anon), que não devolve nenhum dado — RLS esconde as linhas.

import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true })
  if (error) return Response.json({ ok: false, erro: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
