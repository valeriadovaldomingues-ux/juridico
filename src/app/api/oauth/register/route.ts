import { NextResponse } from 'next/server'
import { criarClientId, redirectUriValido } from '@/lib/mcp/oauth'

// Cadastro dinâmico de cliente (RFC 7591). O client_id é assinado e leva o nome e os endereços de retorno;
// só aceitamos retorno para o Claude (claude.ai/claude.com), o ChatGPT (chatgpt.com, caminhos de conector) ou o próprio computador (Desktop/Code).
export async function POST(req: Request) {
  const corpo = await req.json().catch(() => null) as { client_name?: unknown; redirect_uris?: unknown } | null
  const uris = corpo?.redirect_uris
  if (!Array.isArray(uris) || !uris.length || uris.length > 10 || !uris.every(redirectUriValido)) {
    return NextResponse.json({ error: 'invalid_redirect_uri', error_description: 'Endereço de retorno não permitido.' }, { status: 400 })
  }
  const nome = typeof corpo?.client_name === 'string' && corpo.client_name.trim() ? corpo.client_name.trim().slice(0, 80) : 'Claude'
  let clientId: string
  try { clientId = criarClientId({ nome, redirectUris: uris as string[] }) } catch { return NextResponse.json({ error: 'server_error' }, { status: 503 }) }
  return NextResponse.json({
    client_id: clientId, client_name: nome, redirect_uris: uris,
    grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none',
  }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
