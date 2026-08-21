// ─── API Route: GET /api/cron/trello ──────────────────────────────────────────
//
// Execução agendada da sincronização com o Trello (Vercel Cron chama com GET
// e envia automaticamente `Authorization: Bearer ${CRON_SECRET}` quando a
// variável está configurada no projeto — ver vercel.json).
//
// Usa o client de service role: não há sessão de usuário em execuções
// agendadas e a RLS das tabelas exige um papel autenticado.
//
// Sincroniza a integração ativa mais recente (mesma regra do disparo manual
// em /api/trello/sync). Se não houver integração configurada (credenciais/
// board ainda não cadastrados), retorna 404 sem erro — é um estado normal
// até que a integração seja conectada pela tela de Configurações.

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { syncTrelloBoard } from '@/lib/trello/sync'

export const maxDuration = 120

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization') ?? ''

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: integration } = await supabase
    .from('trello_integrations')
    .select('id')
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!integration) {
    return Response.json({ erro: 'Nenhuma integração configurada' }, { status: 404 })
  }

  const { data: running } = await supabase
    .from('trello_sync_logs')
    .select('id')
    .eq('integration_id', integration.id)
    .eq('status', 'em_andamento')
    .maybeSingle()

  if (running) {
    return Response.json({ erro: 'Já há uma sincronização em andamento' }, { status: 409 })
  }

  try {
    const resultado = await syncTrelloBoard(integration.id, null, supabase)
    return Response.json(resultado)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro na sincronização'
    return Response.json({ erro: msg }, { status: 500 })
  }
}
