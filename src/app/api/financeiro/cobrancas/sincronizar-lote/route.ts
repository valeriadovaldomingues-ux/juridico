import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createSupabaseCobrancasStore } from '@/lib/cobrancas-store'
import { COBRANCAS_SELECT, logCobranca } from '@/lib/cobrancas'
import { syncInterCobrancaAction } from '@/lib/cobrancas-workflow'
import { getInterCharge } from '@/lib/interClient'

const LOCK_NAME = 'inter_cobrancas_batch'
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 25
const LOCK_TTL_MS = 5 * 60 * 1000
const ALLOWED_STATUS = ['processando', 'emitida', 'vencida', 'erro_emissao', 'pendente'] as const

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET nao configurado.' }, { status: 503 })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const limit = clampLimit(new URL(req.url).searchParams.get('limit'))
  const supabase = createServiceClient()
  const now = new Date().toISOString()

  const locked = await acquireBatchLock(supabase, now)
  if (!locked) {
    return NextResponse.json({ error: 'Ja existe uma sincronizacao em lote em andamento.' }, { status: 409 })
  }

  const store = createSupabaseCobrancasStore(supabase)
  const summary = {
    total: 0,
    success: 0,
    pending: 0,
    failed: 0,
    skipped: 0,
    limit,
    items: [] as Array<{ id: string; status: number; cobranca_status?: string }>,
  }

  try {
    const { data: cobrancas, error } = await supabase
      .from('cobrancas')
      .select(COBRANCAS_SELECT)
      .not('inter_cobranca_id', 'is', null)
      .in('status', ALLOWED_STATUS as unknown as string[])
      .order('updated_at', { ascending: true })
      .limit(limit)

    if (error) {
      throw new Error(error.message)
    }

    summary.total = cobrancas?.length ?? 0

    for (const cobranca of cobrancas ?? []) {
      const result = await syncInterCobrancaAction({
        role: 'administrativo',
        userId: null,
        store,
        inter: { getInterCharge },
        id: cobranca.id,
        attempts: 1,
        retryDelayMs: 0,
        auditAction: 'sincronizacao_lote_inter',
        eventType: 'sincronizacao_lote_inter',
      })

      summary.items.push({
        id: cobranca.id,
        status: result.status,
        cobranca_status: result.ok ? result.data.status : undefined,
      })

      if (!result.ok) {
        summary.failed += 1
        continue
      }

      if (result.status === 202) {
        summary.pending += 1
      } else {
        summary.success += 1
      }
    }

    await logCobranca(supabase, {
      acao: 'sincronizacao_lote_inter',
      detalhe: `Lote finalizado com ${summary.success} sincronizadas, ${summary.pending} pendentes e ${summary.failed} falhas.`,
      payload: summary,
      usuario_id: null,
    })

    return NextResponse.json(summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao executar sincronizacao em lote.'
    await logCobranca(supabase, {
      acao: 'sincronizacao_lote_inter_erro',
      detalhe: message,
      payload: summary,
      usuario_id: null,
    })
    return NextResponse.json({ error: message }, { status: 502 })
  } finally {
    await releaseBatchLock(supabase, new Date().toISOString(), summary)
  }
}

function clampLimit(raw: string | null) {
  const value = Number(raw ?? DEFAULT_LIMIT)
  if (!Number.isFinite(value) || value < 1) return DEFAULT_LIMIT
  return Math.min(Math.trunc(value), MAX_LIMIT)
}

async function acquireBatchLock(supabase: ReturnType<typeof createServiceClient>, now: string) {
  const lockedUntil = new Date(Date.now() + LOCK_TTL_MS).toISOString()
  const { data, error } = await supabase
    .from('cobranca_sync_locks')
    .update({
      locked_at: now,
      locked_until: lockedUntil,
      locked_by: 'vercel-cron',
      last_started_at: now,
      last_error: null,
      updated_at: now,
    })
    .eq('lock_name', LOCK_NAME)
    .lte('locked_until', now)
    .select('lock_name')
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return !!data
}

async function releaseBatchLock(
  supabase: ReturnType<typeof createServiceClient>,
  now: string,
  summary: Record<string, unknown>,
) {
  await supabase
    .from('cobranca_sync_locks')
    .update({
      locked_until: now,
      locked_by: null,
      last_finished_at: now,
      last_summary: summary,
      updated_at: now,
    })
    .eq('lock_name', LOCK_NAME)
}
