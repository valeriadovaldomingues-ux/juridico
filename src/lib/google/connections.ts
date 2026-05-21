import type { SupabaseClient } from '@supabase/supabase-js'
import {
  GOOGLE_PROVIDER,
  GOOGLE_OAUTH_SCOPES,
  decryptToken,
  encryptToken,
  refreshGoogleAccessToken,
  tokenExpiresAt,
  type GoogleTokenResponse,
} from './oauth'

export interface GoogleConnection {
  id: string
  user_id: string
  provider: string
  google_email: string
  scopes: string[]
  access_token_encrypted: string | null
  refresh_token_encrypted: string | null
  token_expires_at: string | null
  status: 'active' | 'revoked' | 'error'
  created_at: string
  updated_at: string
  revoked_at: string | null
}

export interface SafeGoogleConnection {
  id: string
  google_email: string
  scopes: string[]
  status: GoogleConnection['status']
  token_expires_at: string | null
  updated_at: string
}

export function toSafeConnection(connection: GoogleConnection): SafeGoogleConnection {
  return {
    id: connection.id,
    google_email: connection.google_email,
    scopes: connection.scopes,
    status: connection.status,
    token_expires_at: connection.token_expires_at,
    updated_at: connection.updated_at,
  }
}

export async function getActiveGoogleConnection(
  supabase: SupabaseClient,
  userId: string,
): Promise<GoogleConnection | null> {
  const { data, error } = await supabase
    .from('google_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', GOOGLE_PROVIDER)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as GoogleConnection | null) ?? null
}

export async function saveGoogleConnection(
  supabase: SupabaseClient,
  params: {
    userId: string
    googleEmail: string
    token: GoogleTokenResponse
    existingRefreshTokenEncrypted?: string | null
  },
): Promise<GoogleConnection> {
  const refreshTokenEncrypted = params.token.refresh_token
    ? encryptToken(params.token.refresh_token)
    : params.existingRefreshTokenEncrypted

  if (!refreshTokenEncrypted) {
    throw new Error('Google não retornou refresh_token. Refaça a autorização com consentimento.')
  }

  const payload = {
    user_id: params.userId,
    provider: GOOGLE_PROVIDER,
    google_email: params.googleEmail,
    scopes: params.token.scope?.split(/\s+/).filter(Boolean) ?? [...GOOGLE_OAUTH_SCOPES],
    access_token_encrypted: encryptToken(params.token.access_token),
    refresh_token_encrypted: refreshTokenEncrypted,
    token_expires_at: tokenExpiresAt(params.token.expires_in),
    status: 'active',
    revoked_at: null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('google_connections')
    .upsert(payload, { onConflict: 'user_id,provider' })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as GoogleConnection
}

export async function disconnectGoogleConnection(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('google_connections')
    .update({
      status: 'revoked',
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', GOOGLE_PROVIDER)

  if (error) throw new Error(error.message)
}

export async function getValidAccessToken(
  supabase: SupabaseClient,
  connection: GoogleConnection,
): Promise<string> {
  if (!connection.access_token_encrypted || !connection.refresh_token_encrypted) {
    throw new Error('Conexão Google sem tokens ativos')
  }

  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0
  const shouldRefresh = expiresAt <= Date.now() + 60_000
  if (!shouldRefresh) return decryptToken(connection.access_token_encrypted)

  const refreshed = await refreshGoogleAccessToken(decryptToken(connection.refresh_token_encrypted))
  const accessTokenEncrypted = encryptToken(refreshed.access_token)

  const { error } = await supabase
    .from('google_connections')
    .update({
      access_token_encrypted: accessTokenEncrypted,
      token_expires_at: tokenExpiresAt(refreshed.expires_in),
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id)

  if (error) throw new Error(error.message)
  return refreshed.access_token
}
