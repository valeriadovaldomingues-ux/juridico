import { describe, expect, it } from 'vitest'
import { criarFakeDb } from './testing/fake-db'
import { seedBasico, CLIENTE_A } from './testing/seed'
import { criarSessao, criarSessaoPrevia, validarToken } from './sessao'
import { PREVIA_DURACAO_MS, SESSAO_DURACAO_MS } from './constantes'

const agora = new Date('2026-11-17T15:00:00Z')
const seed = (ativo = true) => ({ ...seedBasico(), portal_acessos: [{ cliente_id: CLIENTE_A, ativo }], portal_sessoes: [] })

describe('sessão do portal: visualização do sócio ("Ver como cliente")', () => {
  it('a sessão de visualização dura 30 min, vale como a do cliente e vem marcada como prévia', async () => {
    const f = criarFakeDb(seed())
    const { token, expiraEm } = await criarSessaoPrevia(f.db, CLIENTE_A, 'socio-1', agora)
    expect(expiraEm.getTime() - agora.getTime()).toBe(PREVIA_DURACAO_MS)
    const s = await validarToken(f.db, token, new Date(agora.getTime() + 60_000))
    expect(s).toMatchObject({ clienteId: CLIENTE_A, previa: true })
    expect(f.tabelas.portal_sessoes[0].user_agent).toBe('previa-socio:socio-1')
  })
  it('expira em 30 minutos', async () => {
    const f = criarFakeDb(seed())
    const { token } = await criarSessaoPrevia(f.db, CLIENTE_A, 'socio-1', agora)
    expect(await validarToken(f.db, token, new Date(agora.getTime() + PREVIA_DURACAO_MS + 1000))).toBeNull()
  })
  it('não contorna a revogação: sem acesso liberado a sessão de visualização também é inválida', async () => {
    const f = criarFakeDb(seed(false))
    const { token } = await criarSessaoPrevia(f.db, CLIENTE_A, 'socio-1', agora)
    expect(await validarToken(f.db, token, agora)).toBeNull()
  })
  it('a sessão normal do cliente NÃO é prévia e dura 12 h', async () => {
    const f = criarFakeDb(seed())
    const { token, expiraEm } = await criarSessao(f.db, CLIENTE_A, { userAgent: 'Mozilla' }, agora)
    expect(expiraEm.getTime() - agora.getTime()).toBe(SESSAO_DURACAO_MS)
    expect((await validarToken(f.db, token, agora))?.previa).toBe(false)
  })
  it('um cliente não consegue se passar por prévia mandando um user-agent igual ao prefixo', async () => {
    const f = criarFakeDb(seed())
    const { token } = await criarSessao(f.db, CLIENTE_A, { userAgent: 'previa-socio:fingido' }, agora)
    expect((await validarToken(f.db, token, agora))?.previa).toBe(false)
  })
})
