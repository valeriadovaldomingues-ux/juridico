import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createServiceClient } from '@/lib/supabase/service'
import { createSupabaseCobrancasStore } from '@/lib/cobrancas-store'
import { createRecurringCobrancasAction } from '@/lib/cobrancas-workflow'

const ALLOWED = ['administrativo', 'gerente', 'socio'] as const

export async function POST(req: NextRequest) {
  const auth = await apiGuard([...ALLOWED])
  if (auth instanceof NextResponse) return auth

  const supabase = createServiceClient()
  const store = createSupabaseCobrancasStore(supabase)
  const result = await createRecurringCobrancasAction({
    role: auth.role,
    userId: auth.userId,
    store,
    body: await req.json(),
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.data, { status: result.status })
}
