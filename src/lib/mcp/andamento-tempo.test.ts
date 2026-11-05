import { describe, expect, it } from 'vitest'
import { FERRAMENTAS_ESCRITA } from './ferramentas-escrita'

const PROC = '11111111-1111-1111-1111-111111111111'
const criar = FERRAMENTAS_ESCRITA.find(f => f.name === 'criar_andamento')!
const ctx = (db: unknown) => ({ db, userId: 'u1', nome: 'Débora' }) as never

// Banco de mentira: registra inserts/deletes e pode falhar a gravação do tempo.
function dbFalso(opts: { falhaTempo?: boolean } = {}) {
  const inserts: [string, unknown][] = []
  const deletes: string[] = []
  const db = {
    from: (t: string) => {
      const c: Record<string, unknown> = {}
      for (const m of ['eq', 'limit', 'order', 'select']) c[m] = () => c
      c.maybeSingle = async () => ({ data: t === 'processos' ? { id: PROC, numero_processo: '0001', titulo: 'Proc', cliente_id: 'c1' } : null, error: null })
      c.insert = (v: unknown) => {
        inserts.push([t, v])
        const erro = opts.falhaTempo && t === 'agenda_time_entries' ? { message: 'falha simulada' } : null
        return { select: () => ({ single: async () => ({ data: erro ? null : { id: `novo-${t}` }, error: erro }) }), then: (r: (v: unknown) => void) => r({ error: erro }) }
      }
      c.delete = () => ({ eq: (_col: string, id: string) => { deletes.push(`${t}:${id}`); return Promise.resolve({ error: null }) } })
      return c
    },
  }
  return { db, inserts, deletes }
}

describe('criar_andamento (tempo obrigatório)', () => {
  it('recusa quando o tempo não é informado, mesmo com confirmar', async () => {
    const { db, inserts } = dbFalso()
    await expect(criar.executar({ processo_id: PROC, titulo: 'Juntada', confirmar: true }, ctx(db))).rejects.toThrow(/tempo gasto/)
    expect(inserts).toHaveLength(0)
  })

  it('recusa tempo inválido', async () => {
    const { db, inserts } = dbFalso()
    await expect(criar.executar({ processo_id: PROC, titulo: 'x', minutos: 0 }, ctx(db))).rejects.toThrow()
    expect(inserts).toHaveLength(0)
  })

  it('sem confirmar só mostra o resumo, com o tempo', async () => {
    const { db, inserts } = dbFalso()
    const r = await criar.executar({ processo_id: PROC, titulo: 'Juntada', minutos: 90 }, ctx(db)) as { confirmacao_necessaria: boolean; resumo: { tempo: string; minutos: number } }
    expect(r.confirmacao_necessaria).toBe(true)
    expect(r.resumo).toMatchObject({ tempo: '1h30', minutos: 90 })
    expect(inserts).toHaveLength(0)
  })

  it('com confirmar grava andamento, tarefa concluída na agenda e o tempo', async () => {
    const { db, inserts } = dbFalso()
    const r = await criar.executar({ processo_id: PROC, titulo: 'Juntada', data: '2026-11-05', minutos: 45, confirmar: true }, ctx(db)) as { gravado: boolean; tempo_lancado: boolean }
    expect(r).toMatchObject({ gravado: true, tempo_lancado: true })
    expect(inserts.map(i => i[0])).toEqual(['processo_andamentos', 'agenda_items', 'agenda_time_entries'])
    expect(inserts[1][1]).toMatchObject({ tipo: 'tarefa', status: 'concluido', andamento_id: 'novo-processo_andamentos', cliente_id: 'c1' })
    expect(inserts[2][1]).toMatchObject({ criado_por: 'u1', processo_id: PROC, cliente_id: 'c1', duracao_manual_minutos: 45, usa_duracao_manual: true })
  })

  it('se o tempo falhar, desfaz a tarefa e o andamento', async () => {
    const { db, deletes } = dbFalso({ falhaTempo: true })
    await expect(criar.executar({ processo_id: PROC, titulo: 'Juntada', minutos: 30, confirmar: true }, ctx(db))).rejects.toThrow(/andamento não foi salvo: falha simulada/)
    expect(deletes).toEqual(['agenda_items:novo-agenda_items', 'processo_andamentos:novo-processo_andamentos'])
  })
})
