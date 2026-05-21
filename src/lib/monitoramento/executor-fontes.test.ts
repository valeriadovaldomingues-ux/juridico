import { describe, expect, it, vi } from 'vitest'
import {
  detalharErroFonte,
  executarFontesComFila,
  resumirExecucaoFontes,
} from './executor-fontes'
import type { FonteMonitoramento, ResultadoMonitoramento } from './fontes'

function fonte(id: string, descricao = 'Ativo via DJEN/CNJ'): FonteMonitoramento {
  return {
    id,
    nome: id.toUpperCase(),
    tribunal: id.toUpperCase(),
    ramo: 'estadual',
    status: 'ativo',
    descricao,
    executar: vi.fn(),
  }
}

function resultado(id: string, erro?: string): ResultadoMonitoramento {
  return {
    fonte_id: id,
    fonte_nome: id.toUpperCase(),
    tribunal: id.toUpperCase(),
    ramo: 'estadual',
    status: erro ? 'erro' : 'ativo',
    encontradas: 0,
    inseridas: 0,
    duplicadas: 0,
    ignoradas: 0,
    falhas: erro ? 1 : 0,
    publicacoes: [],
    erro,
  }
}

describe('executor de fontes de monitoramento', () => {
  it('executa fontes em fila e aplica delay entre fontes DJEN/CNJ', async () => {
    const chamadas: string[] = []
    const sleep = vi.fn().mockResolvedValue(undefined)
    const fontes = [fonte('tjac'), fonte('tjba'), fonte('tjce')]

    await executarFontesComFila({
      fontes,
      sleep,
      delayEntreFontesMs: 123,
      executarFonte: async f => {
        chamadas.push(f.id)
        return resultado(f.id)
      },
    })

    expect(chamadas).toEqual(['tjac', 'tjba', 'tjce'])
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenNthCalledWith(1, 123)
    expect(sleep).toHaveBeenNthCalledWith(2, 123)
  })

  it('faz retry com backoff quando uma fonte retorna rate limit', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined)
    const fontes = [fonte('tjac'), fonte('tjba')]
    const tentativas: Record<string, number> = {}

    const resultados = await executarFontesComFila({
      fontes,
      sleep,
      delayEntreFontesMs: 100,
      backoffRateLimitMs: 999,
      executarFonte: async f => {
        tentativas[f.id] = (tentativas[f.id] ?? 0) + 1
        return f.id === 'tjac' && tentativas[f.id] === 1
          ? resultado(f.id, 'DJEN CNJ indisponível: HTTP 429')
          : resultado(f.id)
      },
    })

    expect(resultados[0]?.erro_detalhado).toBeUndefined()
    expect(tentativas.tjac).toBe(2)
    expect(sleep).toHaveBeenNthCalledWith(1, 999)
    expect(sleep).toHaveBeenNthCalledWith(2, 100)
  })

  it('mantém rate limit detalhado quando retry também falha', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined)
    const fontes = [fonte('tjac'), fonte('tjba')]

    const resultados = await executarFontesComFila({
      fontes,
      sleep,
      delayEntreFontesMs: 100,
      backoffRateLimitMs: 999,
      executarFonte: async f => f.id === 'tjac'
        ? resultado(f.id, 'DJEN CNJ indisponível: HTTP 429')
        : resultado(f.id),
    })

    expect(resultados[0]?.erro_detalhado).toMatchObject({
      tipo: 'rate_limit',
      status_http: 429,
      temporario: true,
    })
    expect(sleep).toHaveBeenNthCalledWith(1, 999)
    expect(sleep).toHaveBeenNthCalledWith(2, 999)
  })

  it('classifica timeout e falha de rede como erro temporario', () => {
    expect(detalharErroFonte(resultado('tjac', 'AbortError: timeout'))).toMatchObject({
      tipo: 'timeout',
      temporario: true,
    })

    expect(detalharErroFonte(resultado('tjba', 'fetch failed'))).toMatchObject({
      tipo: 'rede',
      temporario: true,
    })
  })

  it('resume sucesso, pendencias e erros temporarios', () => {
    const resumo = resumirExecucaoFontes([
      { resultado: resultado('tjac') },
      { resultado: resultado('tjba', 'DJEN CNJ indisponível: HTTP 429'), erro_detalhado: {
        tipo: 'rate_limit',
        status_http: 429,
        mensagem: 'DJEN CNJ indisponível: HTTP 429',
        temporario: true,
      } },
      { resultado: { ...resultado('esaj'), status: 'pendente' } },
    ])

    expect(resumo).toMatchObject({
      total_fontes: 3,
      fontes_sucesso: 1,
      fontes_erro_temporario: 1,
      fontes_rate_limit: 1,
      fontes_pendentes: 1,
    })
    expect(resumo.recomendacao).toContain('rate limit')
  })
})
