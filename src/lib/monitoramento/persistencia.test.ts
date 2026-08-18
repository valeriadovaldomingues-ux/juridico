import { describe, expect, it, vi } from 'vitest'
import {
  construirMapaProcessos,
  gerarHashPublicacao,
  inserirPublicacao,
  vincularProcesso,
} from './persistencia'
import type { PublicacaoCapturada } from './fontes'

vi.mock('@/lib/monitoramento/prazo-detector', () => ({
  detectarPrazosEAudiencias: vi.fn(() => ({
    prazo_detectado: false,
    audiencia_detectada: false,
  })),
  detectarTipoResultado: vi.fn(() => 'publicacao'),
  analisarPublicacao: vi.fn(() => ({ resumo: [] })),
}))

function pub(overrides: Partial<PublicacaoCapturada> = {}): PublicacaoCapturada {
  return {
    fonte_id: 'djen',
    fonte_codigo: 'djen',
    numero_processo: '3587182-05.2025.8.13.0000',
    tribunal: 'TJMG',
    orgao: null,
    diario: 'DJEN',
    data_publicacao: '2026-08-03',
    nome_pesquisado: 'MG98185',
    texto_publicacao: 'Texto de teste',
    origem: 'djen',
    ...overrides,
  }
}

describe('construirMapaProcessos / vincularProcesso', () => {
  it('vincula com correspondência exata', () => {
    const mapa = construirMapaProcessos([{ id: 'p1', numero_processo: '3587182-05.2025.8.13.0000' }])
    const vinculo = vincularProcesso('3587182-05.2025.8.13.0000', mapa)
    expect(vinculo).toEqual({ processo_id: 'p1', grau: 'exata' })
  })

  it('não vincula quando há mais de um processo com o mesmo número', () => {
    const mapa = construirMapaProcessos([
      { id: 'p1', numero_processo: '3587182-05.2025.8.13.0000' },
      { id: 'p2', numero_processo: '35871820520258130000' },
    ])
    const vinculo = vincularProcesso('3587182-05.2025.8.13.0000', mapa)
    expect(vinculo).toEqual({ processo_id: null, grau: 'multipla' })
  })

  it('não vincula quando o processo não é encontrado', () => {
    const mapa = construirMapaProcessos([{ id: 'p1', numero_processo: '0000000-00.2026.8.13.0000' }])
    const vinculo = vincularProcesso('3587182-05.2025.8.13.0000', mapa)
    expect(vinculo).toEqual({ processo_id: null, grau: 'nenhuma' })
  })

  it('não vincula (nem quebra) quando não há número de processo', () => {
    const mapa = construirMapaProcessos([])
    expect(vincularProcesso(null, mapa)).toEqual({ processo_id: null, grau: null })
    expect(vincularProcesso(undefined, mapa)).toEqual({ processo_id: null, grau: null })
  })
})

describe('gerarHashPublicacao', () => {
  it('usa o hash precomputado quando presente (estável entre termos de busca)', () => {
    const a = gerarHashPublicacao(pub({ hash_precomputado: 'djen_abc', nome_pesquisado: 'termo A' }))
    const b = gerarHashPublicacao(pub({ hash_precomputado: 'djen_abc', nome_pesquisado: 'termo B' }))
    expect(a).toBe(b)
    expect(a).toBe('djen_abc')
  })
})

function supabaseFake(options: { existente?: boolean; existentePorIdExterno?: boolean; insertError?: boolean } = {}) {
  const insertCalls: unknown[] = []
  return {
    from: vi.fn((table: string) => {
      if (table !== 'publicacoes') throw new Error(`tabela inesperada: ${table}`)
      let chamadaEq = 0
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation(function (this: any) {
          chamadaEq++
          return this
        }),
        maybeSingle: vi.fn().mockImplementation(() => {
          // 1ª verificação: por hash. 2ª (se chamada): por id_externo.
          if (chamadaEq <= 1) {
            return Promise.resolve({ data: options.existente ? { id: 'existente' } : null, error: null })
          }
          return Promise.resolve({ data: options.existentePorIdExterno ? { id: 'existente-2' } : null, error: null })
        }),
        insert: vi.fn().mockImplementation(payload => {
          insertCalls.push(payload)
          return Promise.resolve({ error: options.insertError ? { message: 'insert falhou' } : null })
        }),
      }
    }),
    insertCalls,
  }
}

describe('inserirPublicacao', () => {
  it('insere nova publicação com vínculo exato de processo', async () => {
    const supabase = supabaseFake()
    const mapa = construirMapaProcessos([{ id: 'p1', numero_processo: '3587182-05.2025.8.13.0000' }])

    const resultado = await inserirPublicacao(supabase as any, pub(), mapa)

    expect(resultado).toBe('inserida')
    expect(supabase.insertCalls[0]).toMatchObject({ processo_id: 'p1', grau_confianca_vinculo: 'exata' })
  })

  it('detecta duplicidade por hash', async () => {
    const supabase = supabaseFake({ existente: true })
    const resultado = await inserirPublicacao(supabase as any, pub(), new Map())
    expect(resultado).toBe('duplicada')
  })

  it('detecta duplicidade pelo identificador oficial do DJEN mesmo com hash diferente', async () => {
    const supabase = supabaseFake({ existentePorIdExterno: true })
    const resultado = await inserirPublicacao(
      supabase as any,
      pub({ id_externo: '685151465' }),
      new Map(),
    )
    expect(resultado).toBe('duplicada')
  })

  it('retorna falha quando o insert do banco falha', async () => {
    const supabase = supabaseFake({ insertError: true })
    const resultado = await inserirPublicacao(supabase as any, pub(), new Map())
    expect(resultado).toBe('falha')
  })
})
