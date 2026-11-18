import { describe, expect, it } from 'vitest'
import { FERRAMENTAS } from './ferramentas'
import { FERRAMENTAS_ESCRITA } from './ferramentas-escrita'

const ID = '44444444-4444-4444-4444-444444444444'
const f = (n: string) => [...FERRAMENTAS, ...FERRAMENTAS_ESCRITA].find(x => x.name === n)!
const ctx = (db: unknown, role = 'advogado') => ({ db, userId: 'u1', nome: 'Tuane', role, podeEscrever: true }) as never

type Registro = { t: string; op: string; v?: unknown }
function dbFalso(cartao: Record<string, unknown> | null, opcoes: { perfis?: unknown[]; horas?: unknown[] } = {}) {
  const log: Registro[] = []
  const db = {
    from: (t: string) => {
      const c: Record<string, unknown> = {}
      for (const m of ['eq', 'neq', 'ilike', 'order', 'limit', 'select']) c[m] = () => c
      c.maybeSingle = async () => ({ data: t === 'kanban_tasks' || t === 'agenda_items' ? cartao : null, error: null })
      c.then = (r: (v: unknown) => void) => r({ data: t === 'profiles' ? (opcoes.perfis ?? []) : t === 'agenda_time_entries' ? (opcoes.horas ?? []) : (cartao ? [cartao] : []), error: null })
      c.insert = (v: unknown) => { log.push({ t, op: 'insert', v }); return { select: () => ({ single: async () => ({ data: { id: 'novo' }, error: null }) }), then: (r: (v: unknown) => void) => r({ error: null }) } }
      c.update = (v: unknown) => { log.push({ t, op: 'update', v }); return { eq: async () => ({ error: null }) } }
      c.delete = () => { log.push({ t, op: 'delete' }); return { eq: async () => ({ error: null }) } }
      return c
    },
    rpc: () => ({}),
  }
  return { db, log }
}
const cartao = { id: ID, titulo: 'Protocolar recurso', descricao: null, tipo: 'tarefa', status: 'a_fazer', prioridade: 'media', data: '2026-11-20', origem: 'manual', numero_processo: null, responsavel_id: 'u9', responsavel: { id: 'u9', nome: 'Marcelo' }, arquivado: false }

describe('kanban (leitura)', () => {
  it('lista os cartões com responsável e prazo', async () => {
    const { db } = dbFalso(cartao)
    const r = await f('kanban').executar({}, ctx(db)) as { total: number; cartoes: { titulo: string; responsavel: string }[] }
    expect(r.total).toBe(1)
    expect(r.cartoes[0]).toMatchObject({ titulo: 'Protocolar recurso', responsavel: 'Marcelo' })
  })
  it('filtra por texto sem acento', async () => {
    const { db } = dbFalso(cartao)
    expect((await f('kanban').executar({ texto: 'PROTOCOLAR' }, ctx(db)) as { total: number }).total).toBe(1)
    expect((await f('kanban').executar({ texto: 'inexistente' }, ctx(db)) as { total: number }).total).toBe(0)
  })
  it('recusa status inválido', async () => {
    await expect(f('kanban').executar({ status: 'x' }, ctx(dbFalso(cartao).db))).rejects.toThrow(/status inválido/)
  })
})

describe('atualizar_cartao_kanban', () => {
  it('sem confirmar mostra antes/depois e não grava', async () => {
    const { db, log } = dbFalso(cartao)
    const r = await f('atualizar_cartao_kanban').executar({ id: ID, status: 'fazendo' }, ctx(db)) as { resumo: { antes: unknown; depois: unknown } }
    expect(r.resumo.antes).toEqual({ coluna: 'a_fazer' })
    expect(r.resumo.depois).toEqual({ coluna: 'fazendo' })
    expect(log).toHaveLength(0)
  })
  it('com confirmar grava, recalcula SLA e registra o histórico', async () => {
    const { db, log } = dbFalso(cartao)
    await f('atualizar_cartao_kanban').executar({ id: ID, status: 'concluido', confirmar: true }, ctx(db))
    const up = log.find(l => l.t === 'kanban_tasks' && l.op === 'update')!.v as Record<string, unknown>
    expect(up.status).toBe('concluido')
    expect(up.concluido_em).toBeTruthy()
    expect(up).toHaveProperty('sla_level')
    const h = log.find(l => l.t === 'kanban_historico')!.v as Record<string, unknown>
    expect(h).toMatchObject({ task_id: ID, usuario_id: 'u1', acao: 'status', de_status: 'a_fazer', para_status: 'concluido' })
  })
  it('troca de responsável procura pelo nome e avisa se for ambíguo', async () => {
    const um = dbFalso(cartao, { perfis: [{ id: 'u2', nome: 'Débora Brito' }] })
    await f('atualizar_cartao_kanban').executar({ id: ID, responsavel: 'Débora', confirmar: true }, ctx(um.db))
    expect((um.log.find(l => l.t === 'kanban_tasks')!.v as Record<string, unknown>).responsavel_id).toBe('u2')
    const dois = dbFalso(cartao, { perfis: [{ id: 'a', nome: 'Ana A' }, { id: 'b', nome: 'Ana B' }] })
    await expect(f('atualizar_cartao_kanban').executar({ id: ID, responsavel: 'Ana' }, ctx(dois.db))).rejects.toThrow(/Mais de um/)
  })
  it('qualquer perfil pode (como na tela), mas exige uma mudança real e dados válidos', async () => {
    await f('atualizar_cartao_kanban').executar({ id: ID, prioridade: 'alta' }, ctx(dbFalso(cartao).db, 'estagiario'))
    await expect(f('atualizar_cartao_kanban').executar({ id: ID, status: 'a_fazer' }, ctx(dbFalso(cartao).db))).rejects.toThrow(/o que mudar/)
    await expect(f('atualizar_cartao_kanban').executar({ id: ID, prazo: '20/11/2026' }, ctx(dbFalso(cartao).db))).rejects.toThrow(/data inválida/)
    await expect(f('atualizar_cartao_kanban').executar({ id: 'abc', status: 'fazendo' }, ctx(dbFalso(cartao).db))).rejects.toThrow(/inválido/)
  })
})

describe('criar_cartao_kanban', () => {
  it('sem confirmar só mostra; com confirmar insere e registra a criação', async () => {
    const a = dbFalso(null)
    const previa = await f('criar_cartao_kanban').executar({ titulo: 'Ligar para o cliente', prazo: '2026-11-25' }, ctx(a.db)) as { resumo: Record<string, unknown> }
    expect(previa.resumo).toMatchObject({ criar_cartao: 'Ligar para o cliente', coluna: 'a_fazer', prioridade: 'media', responsavel: 'Tuane' })
    expect(a.log).toHaveLength(0)
    const b = dbFalso(null)
    await f('criar_cartao_kanban').executar({ titulo: 'Ligar para o cliente', confirmar: true }, ctx(b.db))
    const ins = b.log.find(l => l.t === 'kanban_tasks')!.v as Record<string, unknown>
    expect(ins).toMatchObject({ titulo: 'Ligar para o cliente', responsavel_id: 'u1', origem: 'manual', criado_por: 'u1' })
    expect(String(ins.descricao)).toContain('registrado via Claude por Tuane')
    expect(b.log.find(l => l.t === 'kanban_historico')!.v).toMatchObject({ acao: 'criacao' })
  })
  it('exige título', async () => {
    await expect(f('criar_cartao_kanban').executar({}, ctx(dbFalso(null).db))).rejects.toThrow(/título/)
  })
})

describe('excluir_cartao_kanban', () => {
  it('exclui cartão do sistema só com confirmar', async () => {
    const a = dbFalso(cartao)
    await f('excluir_cartao_kanban').executar({ id: ID }, ctx(a.db))
    expect(a.log).toHaveLength(0)
    await f('excluir_cartao_kanban').executar({ id: ID, confirmar: true }, ctx(a.db))
    expect(a.log).toEqual([{ t: 'kanban_tasks', op: 'delete' }])
  })
  it('não exclui cartão do Trello: manda arquivar', async () => {
    const { db, log } = dbFalso({ ...cartao, origem: 'trello' })
    await expect(f('excluir_cartao_kanban').executar({ id: ID, confirmar: true }, ctx(db))).rejects.toThrow(/arquive/)
    expect(log).toHaveLength(0)
  })
})

describe('excluir_compromisso (regra de perfil)', () => {
  const item = { id: ID, titulo: 'Reunião', tipo: 'evento', status: 'pendente', data_inicio: '2026-11-20', descricao: 'feito na tela', responsavel: 'Marcelo' }
  it('advogado exclui compromisso de outra pessoa; resumo avisa das horas ligadas', async () => {
    const { db, log } = dbFalso(item, { horas: [{ id: 'h1', usa_duracao_manual: true, duracao_manual_minutos: 90 }] })
    const r = await f('excluir_compromisso').executar({ id: ID }, ctx(db, 'advogado')) as { resumo: { atencao_horas: string } }
    expect(r.resumo.atencao_horas).toContain('1h30')
    expect(log).toHaveLength(0)
    await f('excluir_compromisso').executar({ id: ID, confirmar: true }, ctx(db, 'advogado'))
    expect(log).toEqual([{ t: 'agenda_items', op: 'delete' }])
  })
  it('estagiário só exclui o que ele mesmo criou pelo conector', async () => {
    await expect(f('excluir_compromisso').executar({ id: ID }, ctx(dbFalso(item).db, 'estagiario'))).rejects.toThrow(/só exclui por aqui/)
    const meu = { ...item, descricao: 'x\n\n[registrado via Claude por Tuane]' }
    await f('excluir_compromisso').executar({ id: ID }, ctx(dbFalso(meu).db, 'estagiario'))
  })
  it('concluído nunca é excluído, nem por advogado', async () => {
    await expect(f('excluir_compromisso').executar({ id: ID }, ctx(dbFalso({ ...item, status: 'concluido' }).db, 'advogado'))).rejects.toThrow(/concluído/)
  })
})
