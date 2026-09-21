import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createSupabaseCobrancasStore } from '@/lib/cobrancas-store'
import { handleInterWebhookAction } from '@/lib/cobrancas-workflow'

const WEBHOOK_ENABLED = process.env.INTER_WEBHOOK_ENABLED === 'true'

export async function POST(req: NextRequest) {
  if (!WEBHOOK_ENABLED) {
    return NextResponse.json({ error: 'Webhook Inter desativado nesta versao.' }, { status: 410 })
  }

  const raw = await req.text()
  const supabase = createServiceClient()
  const store = createSupabaseCobrancasStore(supabase)
  const result = await handleInterWebhookAction({
    store,
    rawBody: raw,
    headers: req.headers,
    secret: process.env.INTER_WEBHOOK_SECRET,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.data, { status: result.status })
}
