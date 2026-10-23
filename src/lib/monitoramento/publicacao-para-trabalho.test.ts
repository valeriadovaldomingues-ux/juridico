import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  derivarTrabalhoDaPublicacao,
  montarTitulo,
  resumirPartes,
  type DadosPublicacao,
} from '@/lib/monitoramento/publicacao-para-trabalho'

// ─── Apoio ───────────────────────────────────────────────────────────────────

function publicacao(over: Partial<DadosPublicacao> = {}): DadosPublicacao {
  return {
    numero_processo: '0010606-95.2026.5.03.0025',
    processo_id: 'proc-1',
    tribunal: 'TRT3',
    orgao: '25ª VARA DO TRABALHO DE BELO HORIZONTE',
    data_disponibilizacao: '2026-08-18',
    tipo_comunicacao: 'Intimação',
    tipo_publicacao: 'intimacao',
    texto: 'Fica V. Sa. intimado para tomar ciência do despacho.',
    url_oficial: 'https://comunica.pje.jus.br/consulta?x=1',
    partes: [
      { polo: 'A', nome: 'MOISES GOMES DOS SANTOS' },
      { polo: 'P', nome: 'LM COMERCIO EVENTOS LTDA' },
    ],
    prazo_detectado: false,
    prazo_data: null,
    prazo_dias: null,
    prazo_descricao: null,
    audiencia_detectada: false,
    audiencia_data: null,
    ...over,
  }
}

/** Fake mínimo do client: registra inserts e permite forçar erro por tabela. */
function fakeDb(erros: Record<string, string> = {}) {
  const inserts: Array<{ tabela: string; payload: Record<string, unknown> }> = []
  const db = {
    from: (tabela: string) => ({
      insert: (payload: Record<string, unknown>) => {
        inserts.push({ tabela, payload })
        const msg = erros[tabela]
        return Promise.resolve({ error: msg ? { message: msg } : null })
      },
    }),
  }
  return { db, inserts }
}

const ENV_ORIGINAL = process.env.ROBO_PROFILE_ID

beforeEach(() => {
  process.env.ROBO_PROFILE_ID = 'robo-uuid'
})
afterEach(() => {
  if (ENV_ORIGINAL === undefined) delete process.env.ROBO_PROFILE_ID
  else process.env.ROBO_PROFILE_ID = ENV_ORIGINAL
  vi.restoreAllMocks()
})

// ─── Apresentação ────────────────────────────────────────────────────────────

describe('resumirPartes', () => {
  it('monta "ativo X passivo"', () => {
    expect(resumirPartes(publicacao().partes)).toBe(
      'MOISES GOMES DOS SANTOS X LM COMERCIO EVENTOS LTDA',
    )
  })

  it('resume com "E OUTROS" quando passa do limite', () => {
    const partes = [
      { polo: 'A', nome: 'UM' },
      { polo: 'A', nome: 'DOIS' },
      { polo: 'A', nome: 'TRES' },
      { polo: 'P', nome: 'REU' },
    ]
    expect(resumirPartes(partes)).toBe('UM, DOIS E OUTROS X REU')
  })

  it('devolve só o lado que existe quando falta o outro', () => {
    expect(resumirPartes([{ polo: 'A', nome: 'SOZINHO' }])).toBe('SOZINHO')
  })

  it('aguenta partes ausente ou em formato inesperado', () => {
    expect(resumirPartes(null)).toBeNull()
    expect(resumirPartes('texto solto')).toBeNull()
    expect(resumirPartes([])).toBeNull()
  })
})

describe('montarTitulo', () => {
  it('traz processo, data, tribunal, partes e tipo — nessa ordem', () => {
    const t = montarTitulo(publicacao())
    expect(t).toContain('0010606-95.2026.5.03.0025')
    expect(t).toContain('PUBLICAÇÃO DJEN 18/08')
    expect(t).toContain('TRT3')
    expect(t).toContain('MOISES GOMES DOS SANTOS X LM COMERCIO EVENTOS LTDA')
    expect(t.indexOf('MOISES')).toBeLessThan(t.indexOf('25ª VARA'))
  })

  it('trunca órgão quilométrico para as partes não saírem da vista', () => {
    const t = montarTitulo(publicacao({
      orgao: 'Juizado Especial Cível e das Relações de Consumo de Camaragibe - Turno Manhã - 07:00h às 13:00h',
    }))
    expect(t).toContain('…')
    expect(t).toContain('MOISES GOMES DOS SANTOS')
  })

  it('não quebra quando quase tudo está vazio', () => {
    const t = montarTitulo(publicacao({
      numero_processo: null, tribunal: null, orgao: null,
      data_disponibilizacao: null, tipo_comunicacao: null, tipo_publicacao: null,
      partes: null,
    }))
    expect(t).toBe('Publicação sem identificação')
  })
})

// ─── Gravação ────────────────────────────────────────────────────────────────

describe('derivarTrabalhoDaPublicacao', () => {
  it('cria andamento quando há processo e Robô', async () => {
    const { db, inserts } = fakeDb()
    const r = await derivarTrabalhoDaPublicacao(db, 'pub-1', publicacao())

    expect(r.andamento).toBe('criado')
    expect(r.erros).toEqual([])

    const andamento = inserts.find(i => i.tabela === 'processo_andamentos')!
    expect(andamento.payload.tipo).toBe('publicacao')
    expect(andamento.payload.origem).toBe('publicacao')
    expect(andamento.payload.criado_por).toBe('robo-uuid')
    expect(andamento.payload.processo_id).toBe('proc-1')
    expect(andamento.payload.descricao).toContain('https://comunica.pje.jus.br/consulta?x=1')

    expect(inserts.some(i => i.tabela === 'kanban_tasks')).toBe(false)
  })

  it('sem processo vinculado, não inventa andamento', async () => {
    const { db, inserts } = fakeDb()
    const r = await derivarTrabalhoDaPublicacao(db, 'pub-1', publicacao({ processo_id: null }))

    expect(r.andamento).toBe('sem_processo')
    expect(inserts.some(i => i.tabela === 'processo_andamentos')).toBe(false)
  })

  it('sem o Robô configurado, não cria andamento', async () => {
    delete process.env.ROBO_PROFILE_ID
    const { db, inserts } = fakeDb()
    const r = await derivarTrabalhoDaPublicacao(db, 'pub-1', publicacao())

    expect(r.andamento).toBe('sem_robo')
    expect(inserts.some(i => i.tabela === 'processo_andamentos')).toBe(false)
  })

  it('falha de banco não lança — devolve o erro para quem chamou registrar', async () => {
    const { db } = fakeDb({ processo_andamentos: 'permission denied' })
    const r = await derivarTrabalhoDaPublicacao(db, 'pub-1', publicacao())

    expect(r.andamento).toBe('falha')
    expect(r.erros.length).toBeGreaterThan(0)
  })
})
