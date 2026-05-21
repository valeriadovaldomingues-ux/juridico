import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { getActiveGoogleConnection, toSafeConnection } from '@/lib/google/connections'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  try {
    const supabase = await createClient()
    const connection = await getActiveGoogleConnection(supabase, auth.userId)
    return NextResponse.json({
      connected: !!connection,
      connection: connection ? toSafeConnection(connection) : null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar status Google'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
