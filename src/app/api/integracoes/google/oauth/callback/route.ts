import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'
import {
  exchangeGoogleCode,
  fetchGmailProfile,
  validateOAuthState,
} from '@/lib/google/oauth'
import {
  getActiveGoogleConnection,
  saveGoogleConnection,
} from '@/lib/google/connections'

export const runtime = 'nodejs'

function redirectTo(requestUrl: string, status: 'connected' | 'error', message?: string) {
  const url = new URL('/integracoes/gmail', requestUrl)
  url.searchParams.set('google', status)
  if (message) url.searchParams.set('message', message.slice(0, 160))
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const url = new URL(request.url)
  const error = url.searchParams.get('error')
  if (error) return redirectTo(request.url, 'error', error)

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return redirectTo(request.url, 'error', 'Callback Google sem code/state')

  try {
    if (!validateOAuthState(state, auth.userId)) {
      return redirectTo(request.url, 'error', 'State OAuth inválido ou expirado')
    }

    const supabase = await createClient()
    const existing = await getActiveGoogleConnection(supabase, auth.userId)
    const token = await exchangeGoogleCode(code, request.url)
    const gmailProfile = await fetchGmailProfile(token.access_token)

    await saveGoogleConnection(supabase, {
      userId: auth.userId,
      googleEmail: gmailProfile.emailAddress,
      token,
      existingRefreshTokenEncrypted: existing?.refresh_token_encrypted,
    })

    return redirectTo(request.url, 'connected')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao conectar Gmail'
    console.error('[google/oauth/callback] falha segura:', { message })
    return redirectTo(request.url, 'error', message)
  }
}
