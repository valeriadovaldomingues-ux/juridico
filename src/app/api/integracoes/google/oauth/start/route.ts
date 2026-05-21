import { NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { buildGoogleOAuthUrl } from '@/lib/google/oauth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  try {
    return NextResponse.redirect(buildGoogleOAuthUrl(auth.userId, request.url))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao iniciar OAuth Google'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
