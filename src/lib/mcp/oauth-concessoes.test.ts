import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { concessaoAtiva, criarConcessao, renovar, revogarPorRenovacao, trocarCodigo } from './oauth-concessoes'
import { validarTokenAcesso } from './oauth'

process.env.MCP_TOKEN_SECRET = 'segredo-de-teste'

type Linha = Record<string, any>  // eslint-disable-line @typescript-eslint/no-explicit-any

/** Banco falso em memória que imita o encadeamento do supabase-js usado pelas concessões. */
function bancoFalso() {
  const linhas: Linha[] = []
  let seq = 0
  const from = () => ({
    insert: async (l: Linha) => { linhas.push({ id: `g-${++seq}`, revogado_em: null, ultimo_uso_em: null, refresh_hash: null, refresh_hash_anterior: null, ...l }); return { error: null } },
    select: () => consulta('select'),
    update: (patch: Linha) => consulta('update', patch),
  })
  function consulta(modo: 'select' | 'update', patch?: Linha) {
    const filtros: Array<(l: Linha) => boolean> = []
    const q: any = {  // eslint-disable-line @typescript-eslint/no-explicit-any
      eq: (c: string, v: unknown) => (filtros.push(l => l[c] === v), q),
      gt: (c: string, v: string) => (filtros.push(l => l[c] != null && l[c] > v), q),
      is: (c: string, v: null) => (filtros.push(l => l[c] === v), q),
      or: (expr: string) => {
        const pares = expr.split(',').map(p => p.split('.eq.') as [string, string])
        filtros.push(l => pares.some(([c, v]) => l[c] === v)); return q
      },
      select: () => q,
      maybeSingle: async () => { const r = aplicar(); return { data: r[0] ?? null, error: null } },
      then: (ok: (v: unknown) => unknown) => { aplicar(); return Promise.resolve({ error: null }).then(ok) },
    }
    function aplicar() {
      const achadas = linhas.filter(l => filtros.every(f => f(l)))
      if (modo === 'update') achadas.forEach(l => Object.assign(l, patch))
      return achadas.map(l => ({ ...l }))
    }
    return q
  }
  return { db: { from }, linhas }
}

const verifier = 'v'.repeat(43)
const challenge = createHash('sha256').update(verifier).digest('base64url')
const REDIR = 'https://claude.ai/api/mcp/auth_callback'
const agora = Date.UTC(2026, 10, 5)

async function autorizar(db: ReturnType<typeof bancoFalso>['db']) {
  const r = await criarConcessao(db, { userId: 'u-1', clientId: 'c-1', clientNome: 'Claude', redirectUri: REDIR, codeChallenge: challenge, agora })
  if ('erro' in r) throw new Error(r.erro)
  return r.codigo
}

describe('login OAuth do conector', () => {
  it('troca o código por tokens (uma vez só) e guarda só hashes', async () => {
    const { db, linhas } = bancoFalso()
    const codigo = await autorizar(db)
    expect(JSON.stringify(linhas)).not.toContain(codigo)

    const r = await trocarCodigo(db, { codigo, clientId: 'c-1', redirectUri: REDIR, codeVerifier: verifier, agora })
    if (!('tokens' in r)) throw new Error('esperava tokens')
    expect(r.tokens).toMatchObject({ token_type: 'Bearer', expires_in: 3600 })
    expect(validarTokenAcesso(r.tokens.access_token, { agora })).toMatchObject({ ok: true, userId: 'u-1', concessaoId: 'g-1' })
    expect(JSON.stringify(linhas)).not.toContain(r.tokens.refresh_token)

    const de_novo = await trocarCodigo(db, { codigo, clientId: 'c-1', redirectUri: REDIR, codeVerifier: verifier, agora })
    expect(de_novo).toMatchObject({ erro: 'invalid_grant' })
  })

  it('recusa PKCE errado, cliente errado, retorno errado e código vencido', async () => {
    for (const ajuste of [{ codeVerifier: 'x'.repeat(43) }, { clientId: 'c-2' }, { redirectUri: 'https://claude.ai/outro' }]) {
      const { db } = bancoFalso()
      const codigo = await autorizar(db)
      const r = await trocarCodigo(db, { codigo, clientId: 'c-1', redirectUri: REDIR, codeVerifier: verifier, agora, ...ajuste })
      expect(r).toMatchObject({ erro: 'invalid_grant' })
    }
    const { db } = bancoFalso()
    const codigo = await autorizar(db)
    expect(await trocarCodigo(db, { codigo, clientId: 'c-1', redirectUri: REDIR, codeVerifier: verifier, agora: agora + 6 * 60_000 })).toMatchObject({ erro: 'invalid_grant' })
  })

  it('renova trocando o token de renovação; o anterior ainda vale uma vez', async () => {
    const { db } = bancoFalso()
    const codigo = await autorizar(db)
    const ini = await trocarCodigo(db, { codigo, clientId: 'c-1', redirectUri: REDIR, codeVerifier: verifier, agora })
    if (!('tokens' in ini)) throw new Error('esperava tokens')

    const a = await renovar(db, { refreshToken: ini.tokens.refresh_token, clientId: 'c-1', agora: agora + 3600_000 })
    if (!('tokens' in a)) throw new Error('esperava tokens')
    expect(a.tokens.refresh_token).not.toBe(ini.tokens.refresh_token)

    const reuso = await renovar(db, { refreshToken: ini.tokens.refresh_token, clientId: 'c-1', agora: agora + 3700_000 })
    expect('tokens' in reuso).toBe(true)
    expect(await renovar(db, { refreshToken: 'inventado', clientId: 'c-1', agora })).toMatchObject({ erro: 'invalid_grant' })
    expect(await renovar(db, { refreshToken: a.tokens.refresh_token, clientId: 'c-2', agora })).toMatchObject({ erro: 'invalid_grant' })
  })

  it('não renova depois de 180 dias parado', async () => {
    const { db } = bancoFalso()
    const codigo = await autorizar(db)
    const ini = await trocarCodigo(db, { codigo, clientId: 'c-1', redirectUri: REDIR, codeVerifier: verifier, agora })
    if (!('tokens' in ini)) throw new Error('esperava tokens')
    expect(await renovar(db, { refreshToken: ini.tokens.refresh_token, clientId: 'c-1', agora: agora + 181 * 86400_000 })).toMatchObject({ erro: 'invalid_grant' })
  })

  it('revogar derruba o acesso e a renovação na hora', async () => {
    const { db } = bancoFalso()
    const codigo = await autorizar(db)
    const ini = await trocarCodigo(db, { codigo, clientId: 'c-1', redirectUri: REDIR, codeVerifier: verifier, agora })
    if (!('tokens' in ini)) throw new Error('esperava tokens')

    expect(await concessaoAtiva(db, 'g-1', 'u-1', agora)).toBe(true)
    expect(await concessaoAtiva(db, 'g-1', 'outra-pessoa', agora)).toBe(false)
    await revogarPorRenovacao(db, ini.tokens.refresh_token, agora)
    expect(await concessaoAtiva(db, 'g-1', 'u-1', agora)).toBe(false)
    expect(await renovar(db, { refreshToken: ini.tokens.refresh_token, clientId: 'c-1', agora })).toMatchObject({ erro: 'invalid_grant' })
  })
})
