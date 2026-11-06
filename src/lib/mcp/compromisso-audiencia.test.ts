import { describe, expect, it } from 'vitest'
import { FERRAMENTAS_ESCRITA } from './ferramentas-escrita'

const PROC = '11111111-1111-1111-1111-111111111111'
const ITEM = '22222222-2222-2222-2222-222222222222'
const criar = FERRAMENTAS_ESCRITA.find(f => f.name === 'criar_compromisso')!
const atualizar = FERRAMENTAS_ESCRITA.find(f => f.name === 'atualizar_compromisso')!
const ctx = (db: unknown) => ({ db, userId: 'u1', nome: 'Débora' }) as never

/** Banco de mentira: registra inserts e updates; o compromisso atual vem de `atual`. */
function dbFalso(atual: Record<string, unknown> | null = null) {
  const inserts: unknown[] = []
  const updates: unknown[] = []
  const db = {
    from: (t: string) => {
      const c: Record<string, unknown> = {}
      for (const m of ['eq', 'limit', 'order', 'select']) c[m] = () => c
      c.maybeSingle = async () => ({ data: t === 'processos' ? { id: PROC, numero_processo: '0011023-60.2026.5.03.0021', titulo: 'Proc', cliente_id: 'c1' } : atual, error: null })
      c.insert = (v: unknown) => { inserts.push(v); return { select: () => ({ single: async () => ({ data: { id: 'novo' }, error: null }) }) } }
      c.update = (v: unknown) => { updates.push(v); return { eq: async () => ({ error: null }) } }
      return c
    },
  }
  return { db, inserts, updates }
}

const base = { titulo: 'Audiência virtual', tipo: 'audiencia', data_inicio: '2026-11-16', hora_inicio: '08:20' }

describe('criar_compromisso: audiência', () => {
  it('recusa audiência sem processo, mesmo com confirmar', async () => {
    const { db, inserts } = dbFalso()
    await expect(criar.executar({ ...base, confirmar: true }, ctx(db))).rejects.toThrow(/ligadas a um processo/)
    expect(inserts).toHaveLength(0)
  })
  it('com processo, mostra e grava tipo, modalidade e link nos campos próprios', async () => {
    const campos = { processo_id: PROC, responsavel: 'Valéria / Débora', tipo_audiencia: 'una', modalidade: 'virtual', local_ou_link: 'https://zoom.us/x' }
    const previa = await criar.executar({ ...base, ...campos }, ctx(dbFalso().db)) as { resumo: Record<string, unknown> }
    expect(previa.resumo).toMatchObject({ audiencia_tipo: 'una', audiencia_modalidade: 'virtual', audiencia_local: 'https://zoom.us/x', responsavel: 'Valéria / Débora' })
    const { db, inserts } = dbFalso()
    await criar.executar({ ...base, ...campos, confirmar: true }, ctx(db))
    expect(inserts[0]).toMatchObject({ tipo: 'audiencia', processo_id: PROC, audiencia_tipo: 'una', audiencia_modalidade: 'virtual', audiencia_local: 'https://zoom.us/x' })
  })
  it('recusa tipo ou modalidade inventados', async () => {
    const { db } = dbFalso()
    await expect(criar.executar({ ...base, processo_id: PROC, tipo_audiencia: 'xyz' }, ctx(db))).rejects.toThrow(/tipo_audiencia inválido/)
    await expect(criar.executar({ ...base, processo_id: PROC, modalidade: 'xyz' }, ctx(db))).rejects.toThrow(/modalidade inválida/)
  })
  it('tarefa e prazo seguem sem exigir processo nem gravar campos de audiência', async () => {
    const { db, inserts } = dbFalso()
    await criar.executar({ titulo: 'Ligar', tipo: 'tarefa', data_inicio: '2026-11-16', confirmar: true }, ctx(db))
    expect(inserts[0]).not.toHaveProperty('audiencia_tipo')
  })
})

describe('atualizar_compromisso: audiência', () => {
  it('não deixa editar audiência antiga sem processo, a menos que o vínculo vá junto', async () => {
    const solta = { id: ITEM, tipo: 'audiencia', processo_id: null, data_inicio: '2026-10-22' }
    await expect(atualizar.executar({ id: ITEM, data_inicio: '2026-11-18', confirmar: true }, ctx(dbFalso(solta).db))).rejects.toThrow(/ligadas a um processo/)
    const { db, updates } = dbFalso(solta)
    await atualizar.executar({ id: ITEM, data_inicio: '2026-11-18', processo_id: PROC, confirmar: true }, ctx(db))
    expect(updates[0]).toMatchObject({ data_inicio: '2026-11-18', processo_id: PROC })
  })
  it('audiência já ligada ao processo muda de data e de campos normalmente', async () => {
    const { db, updates } = dbFalso({ id: ITEM, tipo: 'audiencia', processo_id: PROC, data_inicio: '2026-10-22' })
    await atualizar.executar({ id: ITEM, data_inicio: '2026-11-18', hora_inicio: '08:05', tipo_audiencia: 'inicial', modalidade: 'presencial', confirmar: true }, ctx(db))
    expect(updates[0]).toMatchObject({ data_inicio: '2026-11-18', hora_inicio: '08:05', audiencia_tipo: 'inicial', audiencia_modalidade: 'presencial' })
  })
  it('transformar uma tarefa em audiência exige processo', async () => {
    const { db } = dbFalso({ id: ITEM, tipo: 'tarefa', processo_id: null })
    await expect(atualizar.executar({ id: ITEM, tipo: 'audiencia', confirmar: true }, ctx(db))).rejects.toThrow(/ligadas a um processo/)
  })
})
