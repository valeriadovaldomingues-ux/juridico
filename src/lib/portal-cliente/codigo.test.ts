import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CODIGO_MAX_TENTATIVAS, CODIGO_VALIDADE_MS } from './constantes'
import { codigoComFormatoValido, conferirCodigo, emitirCodigo, gerarCodigo, hashCodigo } from './codigo'
import { iguaisEmTempoConstante } from './segredos'
import { criarFakeDb } from './testing/fake-db'

const CLIENTE = 'c0000000-0000-4000-8000-000000000001'
const AGORA = new Date('2026-11-15T12:00:00Z')

beforeEach(() => { vi.stubEnv('PORTAL_SEGREDO', 'segredo-de-teste') })

describe('gerar código', () => {
  it('sempre 6 dígitos (com zeros à esquerda)', () => {
    for (let i = 0; i < 200; i++) expect(gerarCodigo()).toMatch(/^\d{6}$/)
  })
  it('valida o formato digitado', () => {
    expect(codigoComFormatoValido('123456')).toBe(true)
    expect(codigoComFormatoValido('12345')).toBe(false)
    expect(codigoComFormatoValido('12345a')).toBe(false)
    expect(codigoComFormatoValido(123456)).toBe(false)
  })
  it('o hash depende do cliente (mesmo código, clientes diferentes → hashes diferentes)', () => {
    expect(hashCodigo(CLIENTE, '123456')).not.toBe(hashCodigo('outro', '123456'))
    expect(hashCodigo(CLIENTE, '123456')).toBe(hashCodigo(CLIENTE, '123456'))
  })
})

describe('comparação em tempo constante', () => {
  it('compara strings hex iguais e diferentes, inclusive de tamanhos diferentes, sem lançar', () => {
    expect(iguaisEmTempoConstante('abc', 'abc')).toBe(true)
    expect(iguaisEmTempoConstante('abc', 'abd')).toBe(false)
    expect(iguaisEmTempoConstante('abc', 'abcd')).toBe(false)
  })
})

describe('emitir e conferir código', () => {
  it('grava só o hash (o código em claro não fica no banco)', async () => {
    const f = criarFakeDb()
    const codigo = await emitirCodigo(f.db, CLIENTE, AGORA)
    const linha = f.tabelas.portal_codigos[0]
    expect(JSON.stringify(linha)).not.toContain(codigo)
    expect(linha.codigo_hash).toBe(hashCodigo(CLIENTE, codigo))
    expect(new Date(linha.expira_em as string).getTime() - AGORA.getTime()).toBe(CODIGO_VALIDADE_MS)
  })

  it('código certo entra uma vez só (uso único)', async () => {
    const f = criarFakeDb()
    const codigo = await emitirCodigo(f.db, CLIENTE, AGORA)
    expect(await conferirCodigo(f.db, CLIENTE, codigo, AGORA)).toBe(true)
    expect(await conferirCodigo(f.db, CLIENTE, codigo, AGORA)).toBe(false)
  })

  it('código errado não entra', async () => {
    const f = criarFakeDb()
    const codigo = await emitirCodigo(f.db, CLIENTE, AGORA)
    const errado = codigo === '000000' ? '000001' : '000000'
    expect(await conferirCodigo(f.db, CLIENTE, errado, AGORA)).toBe(false)
  })

  it('expira em 10 minutos', async () => {
    const f = criarFakeDb()
    const codigo = await emitirCodigo(f.db, CLIENTE, AGORA)
    const depois = new Date(AGORA.getTime() + CODIGO_VALIDADE_MS + 1000)
    expect(await conferirCodigo(f.db, CLIENTE, codigo, depois)).toBe(false)
  })

  it('vale ainda dentro da validade', async () => {
    const f = criarFakeDb()
    const codigo = await emitirCodigo(f.db, CLIENTE, AGORA)
    const quase = new Date(AGORA.getTime() + CODIGO_VALIDADE_MS - 1000)
    expect(await conferirCodigo(f.db, CLIENTE, codigo, quase)).toBe(true)
  })

  it('depois de 5 erros o código é invalidado, mesmo que o certo seja digitado em seguida', async () => {
    const f = criarFakeDb()
    const codigo = await emitirCodigo(f.db, CLIENTE, AGORA)
    const errado = codigo === '000000' ? '000001' : '000000'
    for (let i = 0; i < CODIGO_MAX_TENTATIVAS; i++) expect(await conferirCodigo(f.db, CLIENTE, errado, AGORA)).toBe(false)
    expect(f.tabelas.portal_codigos[0].invalidado_em).toBeTruthy()
    expect(await conferirCodigo(f.db, CLIENTE, codigo, AGORA)).toBe(false)
  })

  it('o 5º palpite certo ainda vale; o 6º não existe', async () => {
    const f = criarFakeDb()
    const codigo = await emitirCodigo(f.db, CLIENTE, AGORA)
    const errado = codigo === '000000' ? '000001' : '000000'
    for (let i = 0; i < CODIGO_MAX_TENTATIVAS - 1; i++) await conferirCodigo(f.db, CLIENTE, errado, AGORA)
    expect(await conferirCodigo(f.db, CLIENTE, codigo, AGORA)).toBe(true)
  })

  it('pedir código novo invalida o anterior', async () => {
    const f = criarFakeDb()
    const antigo = await emitirCodigo(f.db, CLIENTE, AGORA)
    const novo = await emitirCodigo(f.db, CLIENTE, new Date(AGORA.getTime() + 1000))
    expect(await conferirCodigo(f.db, CLIENTE, antigo === novo ? 'x' : antigo, AGORA)).toBe(antigo === novo)
    expect(await conferirCodigo(f.db, CLIENTE, novo, AGORA)).toBe(true)
  })

  it('código de um cliente não abre a conta de outro', async () => {
    const f = criarFakeDb()
    const codigo = await emitirCodigo(f.db, CLIENTE, AGORA)
    expect(await conferirCodigo(f.db, 'c0000000-0000-4000-8000-000000000002', codigo, AGORA)).toBe(false)
  })

  it('palpites em paralelo não passam do limite de tentativas', async () => {
    const f = criarFakeDb()
    const codigo = await emitirCodigo(f.db, CLIENTE, AGORA)
    const palpites = Array.from({ length: 40 }, (_, i) => String(100000 + i)).filter(p => p !== codigo)
    await Promise.all(palpites.map(p => conferirCodigo(f.db, CLIENTE, p, AGORA)))
    expect(f.tabelas.portal_codigos[0].tentativas as number).toBeLessThanOrEqual(CODIGO_MAX_TENTATIVAS)
  })
})
