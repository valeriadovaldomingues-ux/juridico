import { describe, expect, it } from 'vitest'
import { chaveDedup, digitosCnj, formatarCnj, gravarCartoes, validarItem } from './planilha-diaria'

type Linha = Record<string, any>  // eslint-disable-line @typescript-eslint/no-explicit-any

const CNJ = '5179980-72.2021.8.13.0024'
const ITEM = { numero_cnj: CNJ, data_disponibilizacao: '2026-11-05', titulo: `${CNJ} - PUBLICAÇÃO DJEN 05/11 - FBH`, descricao: '**Número CNJ:** x' }

function bancoFalso(opts: { lista?: boolean; processos?: Linha[]; falhaInsert?: { code: string } } = {}) {
  const tarefas: Linha[] = []
  const lista = opts.lista === false ? null : { trello_list_id: 'L-DJEN', trello_list_name: 'Pesquisa automática DJEN (Planilha diária)', posicao: 3 }
  const from = (tabela: string) => {
    const filtros: Array<(l: Linha) => boolean> = []
    let patch: Linha | null = null
    let inserir: Linha | null = null
    const q: any = {  // eslint-disable-line @typescript-eslint/no-explicit-any
      select: () => q, ilike: () => q, limit: () => q, order: () => q,
      eq: (c: string, v: unknown) => (filtros.push(l => l[c] === v), q),
      update: (p: Linha) => (patch = p, q),
      insert: (l: Linha) => (inserir = l, q),
      maybeSingle: async () => {
        if (tabela === 'trello_list_mappings') return { data: lista }
        if (tabela === 'kanban_tasks') {
          const achadas = tarefas.filter(l => filtros.every(f => f(l)))
          const maior = [...tarefas].sort((a, b) => b.ordem - a.ordem)[0]
          return { data: filtros.length >= 2 ? achadas[0] ?? null : maior ?? null }
        }
        return { data: null }
      },
      then: (ok: (v: unknown) => unknown) => {
        if (tabela === 'processos') return Promise.resolve({ data: opts.processos ?? [] }).then(ok)
        if (inserir) {
          if (opts.falhaInsert) return Promise.resolve({ error: opts.falhaInsert }).then(ok)
          tarefas.push({ id: `t${tarefas.length + 1}`, arquivado_em: null, ...inserir }); return Promise.resolve({ error: null }).then(ok)
        }
        if (patch) tarefas.filter(l => filtros.every(f => f(l))).forEach(l => Object.assign(l, patch))
        return Promise.resolve({ error: null }).then(ok)
      },
    }
    return q
  }
  return { db: { from }, tarefas }
}

describe('validação dos itens', () => {
  it('normaliza o CNJ e monta a chave por processo + data', () => {
    expect(digitosCnj(CNJ)).toBe('51799807220218130024')
    expect(digitosCnj('123')).toBeNull()
    expect(formatarCnj('51799807220218130024')).toBe(CNJ)
    expect(chaveDedup('51799807220218130024', '2026-11-05')).toBe('51799807220218130024:2026-11-05')
  })
  it('recusa CNJ inválido, sem data (ou data impossível) e sem título', () => {
    expect(validarItem({ ...ITEM, numero_cnj: '123' })).toEqual({ ok: false, motivo: 'cnj_invalido' })
    expect(validarItem({ ...ITEM, data_disponibilizacao: undefined })).toEqual({ ok: false, motivo: 'sem_data' })
    expect(validarItem({ ...ITEM, data_disponibilizacao: '2026-02-31' })).toEqual({ ok: false, motivo: 'sem_data' })
    expect(validarItem({ ...ITEM, data_disponibilizacao: '05/11/2026' })).toEqual({ ok: false, motivo: 'sem_data' })
    expect(validarItem({ ...ITEM, titulo: '  ' })).toEqual({ ok: false, motivo: 'sem_titulo' })
  })
})

describe('gravação dos cartões', () => {
  it('cria o cartão na coluna do DJEN, vinculando o processo quando é único', async () => {
    const { db, tarefas } = bancoFalso({ processos: [{ id: 'proc-1' }] })
    const r = await gravarCartoes(db, [ITEM], { visivel: true })
    expect(r).toMatchObject({ criados: 1, duplicados: 0 })
    expect(tarefas[0]).toMatchObject({
      origem: 'automacao', origem_id: '51799807220218130024:2026-11-05', status: 'a_fazer', arquivado: false,
      trello_list_id: 'L-DJEN', processo_id: 'proc-1', numero_processo: CNJ,
    })
  })
  it('não vincula processo ambíguo ou ausente', async () => {
    for (const processos of [[], [{ id: 'a' }, { id: 'b' }]]) {
      const { db, tarefas } = bancoFalso({ processos })
      await gravarCartoes(db, [ITEM], { visivel: true })
      expect(tarefas[0].processo_id).toBeNull()
    }
  })
  it('segunda entrega do mesmo processo + data não duplica; outra data cria', async () => {
    const { db, tarefas } = bancoFalso()
    await gravarCartoes(db, [ITEM], { visivel: true })
    const r = await gravarCartoes(db, [ITEM, { ...ITEM, data_disponibilizacao: '2026-11-06' }], { visivel: true })
    expect(r).toMatchObject({ criados: 1, duplicados: 1 })
    expect(tarefas).toHaveLength(2)
  })
  it('conflito de chave única no banco conta como duplicado, outro erro como falha', async () => {
    expect(await gravarCartoes(bancoFalso({ falhaInsert: { code: '23505' } }).db, [ITEM], { visivel: true })).toMatchObject({ duplicados: 1, falhas: 0 })
    expect(await gravarCartoes(bancoFalso({ falhaInsert: { code: 'XX000' } }).db, [ITEM], { visivel: true })).toMatchObject({ duplicados: 0, falhas: 1 })
  })
  it('modo sombra grava arquivado; ao sair da sombra, o mesmo cartão é revelado (sem criar outro)', async () => {
    const { db, tarefas } = bancoFalso()
    await gravarCartoes(db, [ITEM], { visivel: false })
    expect(tarefas[0]).toMatchObject({ arquivado: true, arquivado_em: null })
    const r = await gravarCartoes(db, [ITEM], { visivel: true })
    expect(r).toMatchObject({ revelados: 1, criados: 0 })
    expect(tarefas).toHaveLength(1)
    expect(tarefas[0].arquivado).toBe(false)
  })
  it('cartão arquivado de verdade (com data) não é revelado de novo', async () => {
    const { db, tarefas } = bancoFalso()
    await gravarCartoes(db, [ITEM], { visivel: true })
    Object.assign(tarefas[0], { arquivado: true, arquivado_em: '2026-11-06T00:00:00Z' })
    expect(await gravarCartoes(db, [ITEM], { visivel: true })).toMatchObject({ duplicados: 1, revelados: 0 })
  })
  it('conta os itens recusados e avisa quando a coluna do DJEN não está cadastrada', async () => {
    const { db } = bancoFalso()
    expect(await gravarCartoes(db, [{ ...ITEM, data_disponibilizacao: null }, ITEM], { visivel: true })).toMatchObject({ criados: 1, recusados: 1 })
    expect(await gravarCartoes(bancoFalso({ lista: false }).db, [ITEM], { visivel: true })).toHaveProperty('erro')
  })
})
