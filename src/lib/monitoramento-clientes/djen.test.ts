import { describe, expect, it, vi } from 'vitest'
import { buscarComunicacoesPorNome, DjenErro } from './djen'

function resposta(corpo: unknown, init: { ok?: boolean; status?: number } = {}) {
  return { ok: init.ok ?? true, status: init.status ?? 200, json: async () => corpo } as unknown as Response
}
const itens = (n: number, base = 0) => Array.from({ length: n }, (_, i) => ({ numero_processo: String(base + i).padStart(20, '0') }))

describe('buscarComunicacoesPorNome', () => {
  it('manda os parâmetros certos e pagina até acabar (usando count)', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(resposta({ count: 5, items: itens(2, 0) }))
      .mockResolvedValueOnce(resposta({ count: 5, items: itens(2, 2) }))
      .mockResolvedValueOnce(resposta({ count: 5, items: itens(1, 4) }))
    const sleep = vi.fn().mockResolvedValue(undefined)

    const r = await buscarComunicacoesPorNome({ nome: 'ACME LTDA', desde: '2026-11-01', ate: '2026-11-13', fetchFn, itensPorPagina: 2, sleep, pausaMs: 10 })

    expect(r.itens).toHaveLength(5)
    expect(r.consultas).toBe(3)
    expect(r.truncado).toBe(false)
    expect(sleep).toHaveBeenCalledTimes(2)
    const url = new URL(fetchFn.mock.calls[0][0] as string)
    expect(url.origin + url.pathname).toBe('https://comunicaapi.pje.jus.br/api/v1/comunicacao')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      nomeParte: 'ACME LTDA', dataDisponibilizacaoInicio: '2026-11-01', dataDisponibilizacaoFim: '2026-11-13',
      pagina: '0', itensPorPagina: '2',
    })
    expect(new URL(fetchFn.mock.calls[2][0] as string).searchParams.get('pagina')).toBe('2')
  })

  it('para no limite de páginas e avisa que truncou', async () => {
    const fetchFn = vi.fn().mockImplementation(async () => resposta({ count: 1000, items: itens(2) }))
    const r = await buscarComunicacoesPorNome({ nome: 'X', desde: 'a', ate: 'b', fetchFn, itensPorPagina: 2, maxPaginas: 2, pausaMs: 0 })
    expect(r.consultas).toBe(2)
    expect(r.truncado).toBe(true)
  })

  it('sem count, página incompleta encerra', async () => {
    const fetchFn = vi.fn().mockResolvedValue(resposta({ items: itens(1) }))
    const r = await buscarComunicacoesPorNome({ nome: 'X', desde: 'a', ate: 'b', fetchFn, itensPorPagina: 100, pausaMs: 0 })
    expect(r.consultas).toBe(1)
  })

  it('403 do WAF vira DjenErro com status', async () => {
    const fetchFn = vi.fn().mockResolvedValue(resposta({}, { ok: false, status: 403 }))
    await expect(buscarComunicacoesPorNome({ nome: 'X', desde: 'a', ate: 'b', fetchFn })).rejects.toMatchObject({ name: 'DjenErro', status: 403 })
  })

  it('erro de rede também vira DjenErro', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('ECONNRESET'))
    const p = buscarComunicacoesPorNome({ nome: 'X', desde: 'a', ate: 'b', fetchFn })
    await expect(p).rejects.toBeInstanceOf(DjenErro)
    await expect(p).rejects.toThrow('ECONNRESET')
  })
})
