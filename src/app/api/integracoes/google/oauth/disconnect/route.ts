import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { disconnectGoogleConnection } from '@/lib/google/connections'

export const runtime = 'nodejs'

export async function DELETE() {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  try {
    const supabase = await createClient()
    await disconnectGoogleConnection(supabase, auth.userId)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao desconectar Gmail'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
