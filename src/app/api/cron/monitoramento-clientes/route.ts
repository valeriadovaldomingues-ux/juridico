// ─── API Route: GET /api/cron/monitoramento-clientes ─────────────────────────
//
// Execução agendada (Vercel Cron envia `Authorization: Bearer ${CRON_SECRET}`;
// ver vercel.json). Consulta o DJEN pelo nome dos clientes monitorados, cria
// alertas de processos ainda não cadastrados e manda UM e-mail-resumo aos sócios.
//
// Service role: não há sessão em execuções agendadas e as tabelas de
// monitoramento de clientes têm RLS sem policies (só service role).
//
// Parâmetro opcional `?dias=N` (1–60) alarga a janela para um backfill manual
// (continua exigindo o CRON_SECRET).

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { executarMonitoramentoClientes, MigracaoPendenteErro } from '@/lib/monitoramento-clientes/executar'
import { notificarAlertasPendentes } from '@/lib/monitoramento-clientes/notificar'
import { hojeSaoPaulo, somarDias } from '@/lib/monitoramento-clientes/datas'

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

  const dias = Number(new URL(request.url).searchParams.get('dias'))
  const desde = Number.isInteger(dias) && dias >= 1 && dias <= 60
    ? somarDias(hojeSaoPaulo(), -dias)
    : undefined

  let resumo
  try {
    resumo = await executarMonitoramentoClientes({ supabase, desde })
  } catch (e) {
    // Antes de a migração ser aplicada não há o que fazer: não é erro do cron.
    if (e instanceof MigracaoPendenteErro) return Response.json({ sucesso: true, ignorado: e.message })
    console.error('[cron monitoramento-clientes] falha na execução:', e)
    return Response.json({ sucesso: false, erro: e instanceof Error ? e.message : 'Falha na execução' }, { status: 500 })
  }

  // O e-mail nunca derruba o cron: falha é registrada e a rodada segue.
  let email
  try {
    email = await notificarAlertasPendentes({ supabase })
  } catch (e) {
    console.error('[cron monitoramento-clientes] falha ao avisar por e-mail:', e)
    email = { enviado: false, alertas: 0, destinatarios: 0, motivo: e instanceof Error ? e.message : 'Falha ao avisar por e-mail' }
  }

  const { alertas, ...contagens } = resumo
  return Response.json({
    sucesso: true,
    ...contagens,
    alertas_criados: alertas.map(a => ({ cliente: a.cliente, numero_processo: a.numero_processo, tribunal: a.tribunal, polo: a.polo })),
    email,
  })
}
