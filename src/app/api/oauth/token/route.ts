import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { lerClientId } from '@/lib/mcp/oauth'
import { renovar, trocarCodigo } from '@/lib/mcp/oauth-concessoes'

const NO_STORE = { 'Cache-Control': 'no-store', Pragma: 'no-cache' }
const falha = (error: string, error_description: string, status = 400) =>
  NextResponse.json({ error, error_description }, { status, headers: NO_STORE })

async function lerCorpo(req: Request): Promise<Record<string, string>> {
  const tipo = req.headers.get('content-type') ?? ''
  if (tipo.includes('application/json')) {
    const j = await req.json().catch(() => ({})) as Record<string, unknown>
    return Object.fromEntries(Object.entries(j).map(([k, v]) => [k, String(v ?? '')]))
  }
  return Object.fromEntries(new URLSearchParams(await req.text()))
}

// Endpoint de tokens: troca o código de autorização (PKCE) por tokens e renova o acesso. Cliente público (sem segredo).
export async function POST(req: Request) {
  const c = await lerCorpo(req)
  let cliente
  try { cliente = lerClientId(c.client_id) } catch { return falha('server_error', 'Conector não configurado.', 503) }
  if (!cliente) return falha('invalid_client', 'Cliente desconhecido. Refaça a conexão no Claude.', 401)

  let db
  try { db = createServiceClient() } catch { return falha('server_error', 'Conector não configurado.', 503) }

  let r
  if (c.grant_type === 'authorization_code') {
    if (!c.code || !c.code_verifier || !cliente.redirectUris.includes(c.redirect_uri)) return falha('invalid_request', 'Faltam parâmetros ou o endereço de retorno não confere.')
    r = await trocarCodigo(db, { codigo: c.code, clientId: c.client_id, redirectUri: c.redirect_uri, codeVerifier: c.code_verifier })
  } else if (c.grant_type === 'refresh_token') {
    if (!c.refresh_token) return falha('invalid_request', 'Falta o token de renovação.')
    r = await renovar(db, { refreshToken: c.refresh_token, clientId: c.client_id })
  } else {
    return falha('unsupported_grant_type', 'Use authorization_code ou refresh_token.')
  }

  if ('erro' in r) return falha(r.erro, r.descricao, r.erro === 'server_error' ? 500 : 400)
  // Quem sair da lista do conector não consegue usar o token: /api/mcp confere a lista a cada chamada.
  console.info('[mcp] oauth', JSON.stringify({ grant_type: c.grant_type }))
  return NextResponse.json(r.tokens, { headers: NO_STORE })
}
