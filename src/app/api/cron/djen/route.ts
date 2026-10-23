// ─── API Route: GET /api/cron/djen ───────────────────────────────────────────
//
// Execução agendada da consulta ao DJEN (Vercel Cron chama com GET e envia
// automaticamente `Authorization: Bearer ${CRON_SECRET}` quando a variável
// está configurada no projeto — ver vercel.json).
//
// Usa o client de service role: não há sessão de usuário em execuções
// agendadas e a RLS das tabelas exige um papel autenticado.
//
// Limitação documentada: o WAF do CNJ pode recusar IPs de datacenter
// (HTTP 403). Nesse caso a execução é registrada em monitoramento_logs com o
// erro e uma notificação crítica orienta a consulta pelo navegador.

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { executarBuscaMonitoramento } from '@/lib/monitoramento/executar-busca'

export const maxDuration = 300

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

  const resultado = await executarBuscaMonitoramento({
    supabase,
    filtro: { fonte: 'djen' },
    disparadoPor: 'cron',
  })

  return Response.json(resultado.body, { status: resultado.status })
}
