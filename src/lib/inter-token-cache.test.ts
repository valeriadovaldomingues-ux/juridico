import { describe, expect, it, vi } from 'vitest'
import { MARGEM_TOKEN_MS, VALIDADE_MAXIMA_MS, criarCacheToken } from './inter-token-cache'

const resposta = (t: string, expires_in?: number) => ({ access_token: t, expires_in })

describe('criarCacheToken', () => {
  it('reaproveita o token enquanto está no prazo (um só pedido ao Inter)', async () => {
    let agora = 0
    const cache = criarCacheToken(() => agora)
    const buscar = vi.fn(async () => resposta('t1', 3600))
    expect(await cache.obter(buscar)).toBe('t1')
    agora += 10 * 60_000
    expect(await cache.obter(buscar)).toBe('t1')
    expect(buscar).toHaveBeenCalledTimes(1)
  })

  it('renova quando chega perto de vencer (margem de segurança)', async () => {
    let agora = 0
    const cache = criarCacheToken(() => agora)
    let n = 0
    const buscar = vi.fn(async () => resposta(`t${++n}`, 600)) // 10 min
    await cache.obter(buscar)
    agora = 600_000 - MARGEM_TOKEN_MS - 1
    expect(await cache.obter(buscar)).toBe('t1')
    agora = 600_000 - MARGEM_TOKEN_MS
    expect(await cache.obter(buscar)).toBe('t2')
    expect(buscar).toHaveBeenCalledTimes(2)
  })

  it('limita a validade confiada e usa um padrão quando o Inter não informa', async () => {
    let agora = 0
    const cache = criarCacheToken(() => agora)
    let n = 0
    const buscar = vi.fn(async () => resposta(`t${++n}`, 999_999)) // absurdo de longo
    await cache.obter(buscar)
    agora = VALIDADE_MAXIMA_MS
    expect(await cache.obter(buscar)).toBe('t2')

    const cache2 = criarCacheToken(() => agora)
    const b2 = vi.fn(async () => resposta('x'))
    await cache2.obter(b2)
    await cache2.obter(b2)
    expect(b2).toHaveBeenCalledTimes(1)
  })

  it('limpar() força um token novo (ex.: Inter respondeu 401)', async () => {
    const cache = criarCacheToken(() => 0)
    let n = 0
    const buscar = vi.fn(async () => resposta(`t${++n}`, 3600))
    await cache.obter(buscar)
    cache.limpar()
    expect(await cache.obter(buscar)).toBe('t2')
  })

  it('chamadas simultâneas dividem o mesmo pedido', async () => {
    const cache = criarCacheToken(() => 0)
    let liberar!: (r: ReturnType<typeof resposta>) => void
    const buscar = vi.fn(() => new Promise<ReturnType<typeof resposta>>(res => { liberar = res }))
    const a = cache.obter(buscar)
    const b = cache.obter(buscar)
    liberar(resposta('unico', 3600))
    expect(await Promise.all([a, b])).toEqual(['unico', 'unico'])
    expect(buscar).toHaveBeenCalledTimes(1)
  })

  it('falha ao buscar não fica guardada: a próxima chamada tenta de novo', async () => {
    const cache = criarCacheToken(() => 0)
    const buscar = vi.fn()
      .mockRejectedValueOnce(new Error('Inter API 429: Too Many Requests'))
      .mockResolvedValueOnce(resposta('ok', 3600))
    await expect(cache.obter(buscar)).rejects.toThrow('429')
    expect(await cache.obter(buscar)).toBe('ok')
  })
})
