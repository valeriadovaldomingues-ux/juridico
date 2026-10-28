import { describe, expect, it } from 'vitest'
import { FERRAMENTAS } from './ferramentas'
import { FERRAMENTAS_ESCRITA } from './ferramentas-escrita'

const PROC = '11111111-1111-1111-1111-111111111111'
const lancar = FERRAMENTAS_ESCRITA.find(f => f.name === 'lancar_horas')!

// Banco de mentira: guarda o que foi inserido e devolve "lançamentos do dia" configuráveis.
function dbFalso(doDia: unknown[] = []) {
  const inserts: [string, unknown][] = []
  const db = {
    rpc: () => ({}),
    from: (t: string) => {
      const c: Record<string, unknown> = {}
      for (const m of ['eq', 'gte', 'lte', 'ilike', 'limit', 'order']) c[m] = () => c
      c.select = () => c
      c.maybeSingle = async () => ({ data: t === 'processos' ? { id: PROC, numero_processo: '0001', titulo: 'Proc', cliente_id: 'c1' } : null, error: null })
      c.insert = (v: unknown) => { inserts.push([t, v]); return { select: () => ({ single: async () => ({ data: { id: `novo-${t}` }, error: null }) }) } }
      c.then = (r: (v: unknown) => void) => r({ data: t === 'agenda_time_entries' ? doDia : [], error: null })
      return c
    },
  }
  return { db, inserts }
}

describe('lancar_horas', () => {
  it('sem confirmar só mostra o resumo (nada é gravado)', async () => {
    const { db, inserts } = dbFalso()
    const r = await lancar.executar({ processo_id: PROC, descricao: 'Petição', data: '2026-10-27', horas: 1, minutos: 30 }, { db, userId: 'u1', nome: 'Débora' }) as { confirmacao_necessaria: boolean; resumo: { minutos: number } }
    expect(r.confirmacao_necessaria).toBe(true)
    expect(r.resumo.minutos).toBe(90)
    expect(inserts).toHaveLength(0)
  })
  it('com confirmar grava a tarefa na agenda e o tempo, em nome de quem trabalhou', async () => {
    const { db, inserts } = dbFalso()
    await lancar.executar({ processo_id: PROC, descricao: 'Petição', data: '2026-10-27', minutos: 45, confirmar: true }, { db, userId: 'u1', nome: 'Débora' })
    expect(inserts.map(i => i[0])).toEqual(['agenda_items', 'agenda_time_entries'])
    expect(inserts[1][1]).toMatchObject({ criado_por: 'u1', processo_id: PROC, cliente_id: 'c1', duracao_manual_minutos: 45, usa_duracao_manual: true })
  })
  it('lançamento parecido no mesmo dia bloqueia a gravação até o usuário confirmar que é outro', async () => {
    const parecido = [{ id: 'x', descricao_atividade: 'Petição', usa_duracao_manual: true, duracao_manual_minutos: 45, agenda_item: { responsavel: 'Débora' } }]
    const { db, inserts } = dbFalso(parecido)
    const ctx = { db, userId: 'u1', nome: 'Débora' }
    const bloqueado = await lancar.executar({ processo_id: PROC, descricao: 'Petição', data: '2026-10-27', minutos: 45, confirmar: true }, ctx) as { confirmacao_necessaria?: boolean; aviso?: string }
    expect(bloqueado.confirmacao_necessaria).toBe(true)
    expect(bloqueado.aviso).toMatch(/JÁ EXISTE/)
    expect(inserts).toHaveLength(0)
    await lancar.executar({ processo_id: PROC, descricao: 'Petição', data: '2026-10-27', minutos: 45, confirmar: true, permitir_duplicado: true }, ctx)
    expect(inserts).toHaveLength(2)
  })
  it('recusa tempo inválido', async () => {
    const { db } = dbFalso()
    await expect(lancar.executar({ processo_id: PROC, descricao: 'x', minutos: 0 }, { db, userId: 'u1', nome: 'Débora' })).rejects.toThrow()
  })
})

describe('horas_lancadas', () => {
  it('soma os minutos e filtra por responsável', async () => {
    const linhas = [
      { id: '1', inicio_em: '2026-10-27T15:00:00Z', descricao_atividade: 'A', cobravel: true, usa_duracao_manual: true, duracao_manual_minutos: 60, duracao_calculada_minutos: null, processo: null, cliente: { nome: 'C' }, agenda_item: { responsavel: 'Débora Brito' } },
      { id: '2', inicio_em: '2026-10-27T15:00:00Z', descricao_atividade: 'B', cobravel: true, usa_duracao_manual: true, duracao_manual_minutos: 30, duracao_calculada_minutos: null, processo: null, cliente: { nome: 'C' }, agenda_item: { responsavel: 'Cristiano Pessoa' } },
    ]
    const { db } = dbFalso(linhas)
    const f = FERRAMENTAS.find(x => x.name === 'horas_lancadas')!
    const r = await f.executar({ responsavel: 'débora' }, { db, userId: 'u1', nome: 'Débora' }) as { total_minutos: number; lancamentos: unknown[] }
    expect(r.lancamentos).toHaveLength(1)
    expect(r.total_minutos).toBe(60)
  })
})
