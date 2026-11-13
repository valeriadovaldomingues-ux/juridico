import { describe, expect, it } from 'vitest'
import {
  ACESSO_SEGUNDOS, criarClientId, desafioBearer, gerarTokenAcesso, lerClientId, metadadosServidor,
  pkceConfere, redirectUriValido, urlRetorno, validarPedidoAutorizacao, validarTokenAcesso,
} from './oauth'
import { createHash } from 'node:crypto'

const env = { MCP_TOKEN_SECRET: 'segredo-de-teste' }
const agora = Date.UTC(2026, 10, 5)
const CALLBACK = 'https://claude.ai/api/mcp/auth_callback'
const verifier = 'a'.repeat(43)
const challenge = createHash('sha256').update(verifier).digest('base64url')

describe('endereços de retorno', () => {
  it('aceita o Claude e o próprio computador; recusa o resto', () => {
    expect(redirectUriValido(CALLBACK)).toBe(true)
    expect(redirectUriValido('https://claude.com/api/mcp/auth_callback')).toBe(true)
    expect(redirectUriValido('http://127.0.0.1:54545/callback')).toBe(true)
    expect(redirectUriValido('http://localhost:3000/cb')).toBe(true)
    expect(redirectUriValido('https://evil.example/cb')).toBe(false)
    expect(redirectUriValido('https://claude.ai.evil.example/cb')).toBe(false)
    expect(redirectUriValido('http://claude.ai/cb')).toBe(false)
    expect(redirectUriValido('https://claude.ai/cb#x')).toBe(false)
    expect(redirectUriValido('javascript:alert(1)')).toBe(false)
  })
  it('aceita o ChatGPT só nos caminhos de conector; recusa o resto do chatgpt.com e domínios parecidos', () => {
    expect(redirectUriValido('https://chatgpt.com/connector_platform_oauth_redirect')).toBe(true)
    expect(redirectUriValido('https://chatgpt.com/connector/oauth/abc123_DEF-9')).toBe(true)
    expect(redirectUriValido('https://chatgpt.com/')).toBe(false)
    expect(redirectUriValido('https://chatgpt.com/c/qualquer-conversa')).toBe(false)
    expect(redirectUriValido('https://chatgpt.com/connector/oauth/a/b')).toBe(false)
    expect(redirectUriValido('https://chatgpt.com/connector_platform_oauth_redirect?x=1')).toBe(false)
    expect(redirectUriValido('http://chatgpt.com/connector_platform_oauth_redirect')).toBe(false)
    expect(redirectUriValido('https://chatgpt.com.evil.example/connector_platform_oauth_redirect')).toBe(false)
    expect(redirectUriValido('https://evilchatgpt.com/connector_platform_oauth_redirect')).toBe(false)
  })
})

describe('client_id assinado (cadastro dinâmico)', () => {
  it('vai e volta, e recusa adulterado', () => {
    const id = criarClientId({ nome: 'Claude', redirectUris: [CALLBACK] }, env)
    expect(lerClientId(id, env)).toEqual({ nome: 'Claude', redirectUris: [CALLBACK] })
    expect(lerClientId(id, { MCP_TOKEN_SECRET: 'outro' })).toBeNull()
    const [p, s] = id.slice('pedvc_'.length).split('.')
    const forjado = Buffer.from(JSON.stringify({ n: 'x', r: ['https://claude.ai/outro'] })).toString('base64url')
    expect(lerClientId(`pedvc_${forjado}.${s}`, env)).toBeNull()
    expect(lerClientId(`pedvc_${p}`, env)).toBeNull()
    expect(lerClientId('lixo', env)).toBeNull()
  })
})

describe('PKCE', () => {
  it('confere S256', () => {
    expect(pkceConfere(verifier, challenge)).toBe(true)
    expect(pkceConfere('b'.repeat(43), challenge)).toBe(false)
    expect(pkceConfere('curto', challenge)).toBe(false)
  })
})

describe('token de acesso', () => {
  const d = { concessaoId: 'g-1', userId: 'u-1', clientId: 'c-1' }
  it('gera, valida e expira em 1h', () => {
    const { token, expiraEm } = gerarTokenAcesso(d, { env, agora })
    expect(expiraEm).toBe(ACESSO_SEGUNDOS)
    expect(validarTokenAcesso(token, { env, agora })).toEqual({ ok: true, concessaoId: 'g-1', userId: 'u-1' })
    expect(validarTokenAcesso(token, { env, agora: agora + 3601_000 })).toMatchObject({ ok: false, motivo: 'expirada' })
  })
  it('recusa adulterado e respeita a revogação geral por data', () => {
    const { token } = gerarTokenAcesso(d, { env, agora })
    expect(validarTokenAcesso(token, { env: { MCP_TOKEN_SECRET: 'outro' }, agora })).toMatchObject({ ok: false, motivo: 'assinatura' })
    expect(validarTokenAcesso('pedv_x.y', { env, agora })).toMatchObject({ ok: false, motivo: 'formato' })
    expect(validarTokenAcesso(token, { env: { ...env, MCP_TOKENS_REVOGADOS_ANTES: '2026-11-06T00:00:00Z' }, agora })).toMatchObject({ ok: false, motivo: 'revogada' })
  })
})

describe('pedido de autorização', () => {
  const client_id = criarClientId({ nome: 'Claude', redirectUris: [CALLBACK] }, env)
  const base = { client_id, redirect_uri: CALLBACK, state: 'abc', code_challenge: challenge, code_challenge_method: 'S256', response_type: 'code' }
  it('aceita o pedido do Claude', () => {
    expect(validarPedidoAutorizacao(base, env)).toMatchObject({ ok: true, pedido: { redirectUri: CALLBACK, state: 'abc', clienteNome: 'Claude' } })
  })
  it('recusa retorno fora do cadastro, cliente forjado e falta de PKCE', () => {
    expect(validarPedidoAutorizacao({ ...base, redirect_uri: 'https://claude.ai/outro' }, env)).toMatchObject({ ok: false })
    expect(validarPedidoAutorizacao({ ...base, client_id: 'pedvc_x.y' }, env)).toMatchObject({ ok: false })
    expect(validarPedidoAutorizacao({ ...base, code_challenge: undefined }, env)).toMatchObject({ ok: false })
    expect(validarPedidoAutorizacao({ ...base, code_challenge_method: 'plain' }, env)).toMatchObject({ ok: false })
    expect(validarPedidoAutorizacao({ ...base, response_type: 'token' }, env)).toMatchObject({ ok: false })
  })
  it('monta a volta ao Claude com o state', () => {
    expect(urlRetorno(CALLBACK, 'abc', { code: 'xyz' })).toBe(`${CALLBACK}?code=xyz&state=abc`)
    expect(urlRetorno(CALLBACK, '', { error: 'access_denied' })).toBe(`${CALLBACK}?error=access_denied`)
  })
})

describe('metadados', () => {
  it('apontam para os endereços do próprio PEDV', () => {
    const m = metadadosServidor('https://juridico.pessoaedoval.com.br')
    expect(m).toMatchObject({
      authorization_endpoint: 'https://juridico.pessoaedoval.com.br/oauth/authorize',
      token_endpoint: 'https://juridico.pessoaedoval.com.br/api/oauth/token',
      code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'],
    })
    expect(desafioBearer('https://x.test')).toContain('resource_metadata="https://x.test/.well-known/oauth-protected-resource/api/mcp"')
  })
})
