import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createServiceClient } from '@/lib/supabase/service'
import { createSupabaseCobrancasStore } from '@/lib/cobrancas-store'
import { syncInterCobrancaAction } from '@/lib/cobrancas-workflow'
import { getInterCharge } from '@/lib/interClient'

const ALLOWED = ['administrativo', 'gerente', 'socio'] as const

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard([...ALLOWED])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = createServiceClient()
  const store = createSupabaseCobrancasStore(supabase)

  const result = await syncInterCobrancaAction({
    role: auth.role,
    userId: auth.userId,
    store,
    inter: { getInterCharge },
    id,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.data, { status: result.status })
}
