import { describe, expect, it } from 'vitest'
import { listarAcessos, revogarAcesso } from './oauth-acessos'

type Linha = Record<string, any>  // eslint-disable-line @typescript-eslint/no-explicit-any

function bancoFalso(concessoes: Linha[], perfis: Linha[] = []) {
  const from = (tabela: string) => {
    const base = tabela === 'profiles' ? perfis : concessoes
    const filtros: Array<(l: Linha) => boolean> = []
    let patch: Linha | null = null
    const q: any = {  // eslint-disable-line @typescript-eslint/no-explicit-any
      select: () => q, order: () => q, limit: () => q,
      update: (p: Linha) => (patch = p, q),
      not: (c: string, _op: string, v: null) => (filtros.push(l => l[c] !== v), q),
      is: (c: string, v: null) => (filtros.push(l => l[c] === v), q),
      eq: (c: string, v: unknown) => (filtros.push(l => l[c] === v), q),
      in: (c: string, vs: unknown[]) => (filtros.push(l => vs.includes(l[c])), q),
      then: (ok: (v: unknown) => unknown) => {
        const achadas = base.filter(l => filtros.every(f => f(l)))
        if (patch) achadas.forEach(l => Object.assign(l, patch))
        return Promise.resolve({ data: achadas.map(l => ({ ...l })), error: null }).then(ok)
      },
    }
    return q
  }
  return { from }
}

const dados = () => [
  { id: 'a1', user_id: 'u1', client_nome: 'Claude', criado_em: '2026-11-05T10:00:00Z', ultimo_uso_em: '2026-11-05T12:00:00Z', refresh_expira_em: '2027-05-04T10:00:00Z', refresh_hash: 'h1', revogado_em: null },
  { id: 'a2', user_id: 'u2', client_nome: null, criado_em: '2026-11-04T10:00:00Z', ultimo_uso_em: null, refresh_expira_em: null, refresh_hash: 'h2', revogado_em: null },
  { id: 'a3', user_id: 'u2', client_nome: 'Claude', criado_em: '2026-11-03T10:00:00Z', ultimo_uso_em: null, refresh_expira_em: null, refresh_hash: 'h3', revogado_em: '2026-11-04T00:00:00Z' },
  { id: 'a4', user_id: 'u2', client_nome: 'Claude', criado_em: '2026-11-03T10:00:00Z', ultimo_uso_em: null, refresh_expira_em: null, refresh_hash: null, revogado_em: null },
]
const perfis = [{ id: 'u1', nome: 'Débora Brito' }, { id: 'u2', nome: 'Tuane Miranda' }]

describe('painel de acessos do conector', () => {
  it('lista só os ativos e autorizados, com o nome da pessoa', async () => {
    const r = await listarAcessos(bancoFalso(dados(), perfis))
    expect(r.map(a => a.id)).toEqual(['a1', 'a2'])
    expect(r[0]).toMatchObject({ usuario_nome: 'Débora Brito', cliente: 'Claude' })
    expect(r[1]).toMatchObject({ usuario_nome: 'Tuane Miranda', cliente: 'Claude' })
  })
  it('com userId, só os dessa pessoa', async () => {
    expect((await listarAcessos(bancoFalso(dados(), perfis), { userId: 'u2' })).map(a => a.id)).toEqual(['a2'])
  })
  it('cada um revoga só os seus; o sócio revoga qualquer um; revogar duas vezes não conta', async () => {
    const db = bancoFalso(dados(), perfis)
    expect(await revogarAcesso(db, 'a1', { userId: 'u2' })).toBe(false)
    expect(await revogarAcesso(db, 'a1', { userId: 'u1' })).toBe(true)
    expect(await revogarAcesso(db, 'a1', { userId: 'u1' })).toBe(false)
    expect(await revogarAcesso(db, 'a2')).toBe(true)
    expect(await listarAcessos(db)).toEqual([])
  })
})
