import { describe, expect, it } from 'vitest'
import { FERRAMENTAS_ESCRITA } from './ferramentas-escrita'

const AND = '33333333-3333-3333-3333-333333333333'
const atualizar = FERRAMENTAS_ESCRITA.find(f => f.name === 'atualizar_andamento')!
const ctx = (db: unknown, role: string) => ({ db, userId: 'u1', nome: 'Tuane', role }) as never
const atual = { id: AND, processo_id: 'p1', data_andamento: '2026-11-10T15:00:00Z', tipo: 'despacho', titulo: 'Errado', descricao: 'x', origem: 'manual', responsavel_id: null }

function dbFalso(historicoFalha = false) {
  const inserts: { t: string; v: unknown }[] = []
  const updates: unknown[] = []
  const db = {
    from: (t: string) => {
      const c: Record<string, unknown> = {}
      for (const m of ['eq', 'select']) c[m] = () => c
      c.maybeSingle = async () => ({ data: atual, error: null })
      c.insert = (v: unknown) => {
        inserts.push({ t, v })
        return { select: () => ({ single: async () => (historicoFalha ? { data: null, error: { message: 'x' } } : { data: { id: 'h1' }, error: null }) }) }
      }
      c.update = (v: unknown) => { updates.push(v); return { eq: async () => ({ error: null }) } }
      c.delete = () => ({ eq: async () => ({ error: null }) })
      return c
    },
  }
  return { db, inserts, updates }
}

describe('atualizar_andamento', () => {
  it('advogado: sem confirmar só mostra antes e depois e não grava', async () => {
    const { db, inserts, updates } = dbFalso()
    const r = await atualizar.executar({ id: AND, titulo: 'Certo' }, ctx(db, 'advogado')) as { resumo: { antes: unknown; depois: unknown } }
    expect(r.resumo.antes).toEqual({ titulo: 'Errado' })
    expect(r.resumo.depois).toEqual({ titulo: 'Certo' })
    expect(inserts).toHaveLength(0)
    expect(updates).toHaveLength(0)
  })
  it('advogado: com confirmar grava o histórico antes e depois altera', async () => {
    const { db, inserts, updates } = dbFalso()
    await atualizar.executar({ id: AND, titulo: 'Certo', confirmar: true }, ctx(db, 'advogado'))
    expect(inserts).toHaveLength(1)
    expect(inserts[0].t).toBe('processo_andamentos_historico')
    expect(updates).toHaveLength(1)
  })
  it('se o histórico não puder ser gravado, não altera nada', async () => {
    const { db, updates } = dbFalso(true)
    await expect(atualizar.executar({ id: AND, titulo: 'Certo', confirmar: true }, ctx(db, 'advogado'))).rejects.toThrow(/Nada foi alterado/)
    expect(updates).toHaveLength(0)
  })
  it('comercial e administrativo não editam andamento; estagiário só observação', async () => {
    for (const role of ['comercial', 'administrativo', 'estagiario']) {
      await expect(atualizar.executar({ id: AND, titulo: 'Certo', confirmar: true }, ctx(dbFalso().db, role))).rejects.toThrow(/não pode editar/)
    }
  })
  it('recusa pedido sem nenhuma mudança, id inválido e data inválida', async () => {
    await expect(atualizar.executar({ id: AND }, ctx(dbFalso().db, 'advogado'))).rejects.toThrow(/o que mudar/)
    await expect(atualizar.executar({ id: 'abc', titulo: 'a' }, ctx(dbFalso().db, 'advogado'))).rejects.toThrow(/inválido/)
    await expect(atualizar.executar({ id: AND, data: '10/11/2026' }, ctx(dbFalso().db, 'advogado'))).rejects.toThrow(/data inválida/)
  })
})
