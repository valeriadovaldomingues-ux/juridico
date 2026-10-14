import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createServiceClient } from '@/lib/supabase/service'
import { createSupabaseCobrancasStore } from '@/lib/cobrancas-store'
import { cancelCobrancaAction } from '@/lib/cobrancas-workflow'
import { cancelInterCharge } from '@/lib/interClient'

// POST { motivo? } — cancela a cobrança (no Banco Inter, se já foi emitida). Só sócio.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const result = await cancelCobrancaAction({
    role: auth.role,
    userId: auth.userId,
    store: createSupabaseCobrancasStore(createServiceClient()),
    inter: { cancelInterCharge },
    id,
    motivo: typeof body.motivo === 'string' ? body.motivo : null,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.data, { status: result.status })
}
