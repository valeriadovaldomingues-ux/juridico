import { beforeEach, describe, expect, it, vi } from 'vitest'
import { aplicarLimites, chaveDaTentativa, limpezaOportunista, LIMITES } from './anti-abuso'
import { criarFakeDb } from './testing/fake-db'
import { normalizarTempo } from './tempo'

const AGORA = new Date('2026-11-15T12:00:00Z')
const MIN = 60 * 1000

beforeEach(() => { vi.stubEnv('PORTAL_SEGREDO', 'segredo-de-teste') })

describe('anti-abuso no banco', () => {
  it('permite até o máximo e bloqueia a tentativa seguinte (por documento)', async () => {
    const f = criarFakeDb()
    for (let i = 0; i < 5; i++) expect((await aplicarLimites(f.db, [LIMITES.solicitarPorDocumento('52998224725')], AGORA)).ok).toBe(true)
    const r = await aplicarLimites(f.db, [LIMITES.solicitarPorDocumento('52998224725')], AGORA)
    expect(r).toEqual({ ok: false, tipo: 'solicitar_doc' })
  })

  it('o limite é por documento: outro documento não é afetado', async () => {
    const f = criarFakeDb()
    for (let i = 0; i < 5; i++) await aplicarLimites(f.db, [LIMITES.solicitarPorDocumento('52998224725')], AGORA)
    expect((await aplicarLimites(f.db, [LIMITES.solicitarPorDocumento('11222333000181')], AGORA)).ok).toBe(true)
  })

  it('limite por IP (20/h) bloqueia mesmo com documentos diferentes', async () => {
    const f = criarFakeDb()
    for (let i = 0; i < 20; i++) expect((await aplicarLimites(f.db, [LIMITES.solicitarPorIp('203.0.113.9')], AGORA)).ok).toBe(true)
    expect((await aplicarLimites(f.db, [LIMITES.solicitarPorIp('203.0.113.9')], AGORA)).ok).toBe(false)
    expect((await aplicarLimites(f.db, [LIMITES.solicitarPorIp('203.0.113.10')], AGORA)).ok).toBe(true)
  })

  it('janela deslizante: depois de 1 hora libera de novo', async () => {
    const f = criarFakeDb()
    for (let i = 0; i < 5; i++) await aplicarLimites(f.db, [LIMITES.solicitarPorDocumento('52998224725')], AGORA)
    expect((await aplicarLimites(f.db, [LIMITES.solicitarPorDocumento('52998224725')], new Date(AGORA.getTime() + 30 * MIN))).ok).toBe(false)
    expect((await aplicarLimites(f.db, [LIMITES.solicitarPorDocumento('52998224725')], new Date(AGORA.getTime() + 61 * MIN))).ok).toBe(true)
  })

  it('pedidos: limite por e-mail (3/h) e global', async () => {
    const f = criarFakeDb()
    for (let i = 0; i < 3; i++) expect((await aplicarLimites(f.db, [LIMITES.pedidoPorEmail('a@x.com')], AGORA)).ok).toBe(true)
    expect(await aplicarLimites(f.db, [LIMITES.pedidoPorEmail('A@X.com')], AGORA)).toEqual({ ok: false, tipo: 'pedido_email' })
  })

  it('relatório: 10 por hora por cliente', async () => {
    const f = criarFakeDb()
    for (let i = 0; i < 10; i++) expect((await aplicarLimites(f.db, [LIMITES.relatorioPorCliente('c1')], AGORA)).ok).toBe(true)
    expect((await aplicarLimites(f.db, [LIMITES.relatorioPorCliente('c1')], AGORA)).ok).toBe(false)
    expect((await aplicarLimites(f.db, [LIMITES.relatorioPorCliente('c2')], AGORA)).ok).toBe(true)
  })

  it('bloqueado não registra mais nada (o bloqueio é temporário, não cresce)', async () => {
    const f = criarFakeDb()
    for (let i = 0; i < 8; i++) await aplicarLimites(f.db, [LIMITES.solicitarPorDocumento('52998224725')], AGORA)
    expect(f.tabelas.portal_tentativas.length).toBe(5)
  })

  it('valor ausente (IP desconhecido) não limita esse eixo', async () => {
    const f = criarFakeDb()
    for (let i = 0; i < 30; i++) expect((await aplicarLimites(f.db, [LIMITES.solicitarPorIp(null)], AGORA)).ok).toBe(true)
    expect(f.tabelas.portal_tentativas ?? []).toHaveLength(0)
  })

  it('não guarda documento, IP nem e-mail em claro', async () => {
    const f = criarFakeDb()
    await aplicarLimites(f.db, [LIMITES.solicitarPorDocumento('52998224725'), LIMITES.solicitarPorIp('203.0.113.9'), LIMITES.pedidoPorEmail('fulano@x.com')], AGORA)
    const tudo = JSON.stringify(f.tabelas.portal_tentativas)
    expect(tudo).not.toContain('52998224725')
    expect(tudo).not.toContain('203.0.113.9')
    expect(tudo).not.toContain('fulano')
    expect(chaveDaTentativa('x', 'y')).toMatch(/^[0-9a-f]{40}$/)
  })

  it('limpeza oportunista apaga o que é antigo e só roda no sorteio', async () => {
    const f = criarFakeDb({ portal_tentativas: [{ tipo: 't', chave: 'k', criado_em: '2026-11-01T00:00:00Z' }, { tipo: 't', chave: 'k', criado_em: '2026-11-15T11:59:00Z' }] })
    await limpezaOportunista(f.db, AGORA, 0.9)
    expect(f.tabelas.portal_tentativas).toHaveLength(2)
    await limpezaOportunista(f.db, AGORA, 0.01)
    expect(f.tabelas.portal_tentativas).toHaveLength(1)
  })

  it('migração ausente vira PortalIndisponivel (não 500 genérico)', async () => {
    const f = criarFakeDb()
    f.falharTabela('portal_tentativas', '42P01')
    await expect(aplicarLimites(f.db, [LIMITES.solicitarPorDocumento('52998224725')], AGORA)).rejects.toMatchObject({ name: 'PortalIndisponivel' })
  })
})

describe('normalizar tempo de resposta', () => {
  it('segura a resposta até o mínimo', async () => {
    vi.useFakeTimers()
    try {
      const inicio = Date.now()
      let resolvido = false
      const p = normalizarTempo(inicio, 800).then(() => { resolvido = true })
      await vi.advanceTimersByTimeAsync(799)
      expect(resolvido).toBe(false)
      await vi.advanceTimersByTimeAsync(2)
      await p
      expect(resolvido).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('não atrasa se já passou do mínimo', async () => {
    await expect(normalizarTempo(Date.now() - 5000, 800)).resolves.toBeUndefined()
  })
})
