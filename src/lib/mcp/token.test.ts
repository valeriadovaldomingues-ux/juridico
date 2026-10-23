import { describe, expect, it } from 'vitest'
import { gerarToken, validarToken } from './token'

const env = { MCP_TOKEN_SECRET: 'segredo-de-teste' }
const agora = Date.UTC(2026, 9, 22)

describe('chave pessoal do conector', () => {
  it('gera e valida, devolvendo o usuário', () => {
    const { token, expiraEm } = gerarToken('user-1', { env, agora, dias: 90 })
    expect(token.startsWith('pedv_')).toBe(true)
    expect(expiraEm.getTime()).toBe(agora + 90 * 86400_000)
    expect(validarToken(token, { env, agora })).toEqual({ ok: true, userId: 'user-1' })
  })
  it('recusa adulterada, de outro segredo e malformada', () => {
    const { token } = gerarToken('user-1', { env, agora })
    const [p, s] = token.slice(5).split('.')
    const outro = Buffer.from(JSON.stringify({ u: 'user-2', e: 9e9, i: 1 })).toString('base64url')
    expect(validarToken(`pedv_${outro}.${s}`, { env, agora })).toMatchObject({ ok: false, motivo: 'assinatura' })
    expect(validarToken(token, { env: { MCP_TOKEN_SECRET: 'outro' }, agora })).toMatchObject({ ok: false, motivo: 'assinatura' })
    expect(validarToken('lixo', { env, agora })).toMatchObject({ ok: false, motivo: 'formato' })
    expect(validarToken(`pedv_${p}`, { env, agora })).toMatchObject({ ok: false, motivo: 'formato' })
  })
  it('expira e pode ser revogada por data', () => {
    const { token } = gerarToken('user-1', { env, agora, dias: 1 })
    expect(validarToken(token, { env, agora: agora + 2 * 86400_000 })).toMatchObject({ ok: false, motivo: 'expirada' })
    expect(validarToken(token, { env: { ...env, MCP_TOKENS_REVOGADOS_ANTES: '2026-10-23T00:00:00Z' }, agora })).toMatchObject({ ok: false, motivo: 'revogada' })
  })
})
