import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  derivarPrioridade,
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

describe('derivarPrioridade', () => {
  it('prazo curto é urgente', () => {
    expect(derivarPrioridade(publicacao({ prazo_detectado: true, prazo_dias: 5 }))).toBe('urgente')
  })
  it('prazo médio é alta', () => {
    expect(derivarPrioridade(publicacao({ prazo_detectado: true, prazo_dias: 10 }))).toBe('alta')
  })
  it('prazo longo é média', () => {
    expect(derivarPrioridade(publicacao({ prazo_detectado: true, prazo_dias: 30 }))).toBe('media')
  })
  it('sem prazo detectado é média', () => {
    expect(derivarPrioridade(publicacao())).toBe('media')
  })
})

// ─── Gravação ────────────────────────────────────────────────────────────────

describe('derivarTrabalhoDaPublicacao', () => {
  it('cria andamento e tarefa quando há processo e Robô', async () => {
    const { db, inserts } = fakeDb()
    const r = await derivarTrabalhoDaPublicacao(db, 'pub-1', publicacao())

    expect(r.andamento).toBe('criado')
    expect(r.tarefa).toBe('criada')
    expect(r.erros).toEqual([])

    const andamento = inserts.find(i => i.tabela === 'processo_andamentos')!
    expect(andamento.payload.tipo).toBe('publicacao')
    expect(andamento.payload.origem).toBe('publicacao')
    expect(andamento.payload.criado_por).toBe('robo-uuid')
    expect(andamento.payload.processo_id).toBe('proc-1')

    const tarefa = inserts.find(i => i.tabela === 'kanban_tasks')!
    expect(tarefa.payload.origem).toBe('publicacao')
    expect(tarefa.payload.publicacao_id).toBe('pub-1')
    expect(tarefa.payload.status).toBe('a_fazer')
    expect(tarefa.payload.numero_processo).toBe('0010606-95.2026.5.03.0025')
  })

  it('sem processo vinculado, não inventa andamento — mas a tarefa sai', async () => {
    const { db, inserts } = fakeDb()
    const r = await derivarTrabalhoDaPublicacao(db, 'pub-1', publicacao({ processo_id: null }))

    expect(r.andamento).toBe('sem_processo')
    expect(r.tarefa).toBe('criada')
    expect(inserts.some(i => i.tabela === 'processo_andamentos')).toBe(false)
  })

  it('sem o Robô configurado, a tarefa continua sendo criada', async () => {
    delete process.env.ROBO_PROFILE_ID
    const { db, inserts } = fakeDb()
    const r = await derivarTrabalhoDaPublicacao(db, 'pub-1', publicacao())

    expect(r.andamento).toBe('sem_robo')
    expect(r.tarefa).toBe('criada')
    expect(inserts.some(i => i.tabela === 'kanban_tasks')).toBe(true)
  })

  it('conflito de chave única vira "duplicada", não erro', async () => {
    const { db } = fakeDb({ kanban_tasks: 'duplicate key value violates unique constraint' })
    const r = await derivarTrabalhoDaPublicacao(db, 'pub-1', publicacao())

    expect(r.tarefa).toBe('duplicada')
    expect(r.erros).toEqual([])
  })

  it('prazo detectado vira tipo "prazo", data e SLA na tarefa', async () => {
    const { db, inserts } = fakeDb()
    await derivarTrabalhoDaPublicacao(db, 'pub-1', publicacao({
      prazo_detectado: true, prazo_dias: 5, prazo_data: '2026-08-25',
      prazo_descricao: 'prazo de 5 dias',
    }))

    const tarefa = inserts.find(i => i.tabela === 'kanban_tasks')!
    expect(tarefa.payload.tipo).toBe('prazo')
    expect(tarefa.payload.prioridade).toBe('urgente')
    expect(tarefa.payload.data).toBe('2026-08-25')
    expect(tarefa.payload.sla_due_at).toBeTruthy()
  })

  it('a descrição leva o link da publicação', async () => {
    const { db, inserts } = fakeDb()
    await derivarTrabalhoDaPublicacao(db, 'pub-1', publicacao())
    const tarefa = inserts.find(i => i.tabela === 'kanban_tasks')!
    expect(tarefa.payload.descricao).toContain('https://comunica.pje.jus.br/consulta?x=1')
  })

  it('falha de banco não lança — devolve o erro para quem chamou registrar', async () => {
    const { db } = fakeDb({
      processo_andamentos: 'permission denied',
      kanban_tasks: 'permission denied',
    })
    const r = await derivarTrabalhoDaPublicacao(db, 'pub-1', publicacao())

    expect(r.andamento).toBe('falha')
    expect(r.tarefa).toBe('falha')
    expect(r.erros.length).toBeGreaterThan(0)
  })
})
