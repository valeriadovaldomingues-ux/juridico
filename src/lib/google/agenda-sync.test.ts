import { describe, expect, it } from 'vitest'
import { enviarCompromissoAoGoogle, sincronizarAgendaGoogle, type Calendario, type EventoExistente } from './agenda-sync'

function fakeDb(item: Record<string, unknown> | null, extra: { fila?: { id: string; google_event_id: string }[] } = {}) {
  const updates: Record<string, unknown>[] = []
  const excluidos: string[] = []
  const processo = { numero_processo: '0010976-40.2026.5.03.0004', area_direito: 'trabalhista', cliente: { nome: 'Feito Afeto' }, partes_processo: [{ pessoa_nome: 'Maria Helena', tipo_parte: 'autor' }] }
  const tabela = (t: string) => {
    const c: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'not', 'in', 'gte', 'order', 'limit']) c[m] = () => c
    c.maybeSingle = async () => ({ data: t === 'agenda_items' ? item : t === 'processos' ? processo : null, error: null })
    c.update = (v: Record<string, unknown>) => { updates.push(v); return { eq: async () => ({ error: null }) } }
    c.delete = () => ({ eq: async (_: string, id: string) => { excluidos.push(id); return { error: null } } })
    c.then = (r: (v: unknown) => void) => r({ data: t === 'agenda_items' ? (item ? [{ id: item.id }] : []) : t === 'agenda_google_exclusoes' ? extra.fila ?? [] : [], error: null })
    return c
  }
  return { db: { from: tabela }, updates, excluidos }
}

function fakeCal(doDia: EventoExistente[] = []) {
  const chamadas: string[] = []
  const cal: Calendario = {
    eventosDoDia: async () => doDia,
    criar: async e => { chamadas.push(`criar:${e.summary}:${e.start.dateTime}:${e.colorId ?? ''}`); return 'g-novo' },
    atualizar: async id => { chamadas.push(`atualizar:${id}`) },
    apagar: async id => { chamadas.push(`apagar:${id}`) },
  }
  return { cal, chamadas }
}

const prazo = { id: 'i1', titulo: 'Apresentar contrarrazões', tipo: 'prazo', status: 'pendente', data_inicio: '2026-10-28', prazo_final: '2026-10-30', hora_inicio: null, descricao: 'Texto', processo_id: 'p1', cliente_id: null, google_event_id: null, google_hash: null }

describe('enviarCompromissoAoGoogle', () => {
  it('cria o prazo na madrugada do dia final, sem cor, e guarda o id', async () => {
    const { db, updates } = fakeDb(prazo); const { cal, chamadas } = fakeCal()
    const r = await enviarCompromissoAoGoogle(db, cal, 'i1')
    expect(r).toMatchObject({ ok: true, acao: 'criado', eventoId: 'g-novo' })
    expect(chamadas[0]).toBe('criar:PRAZO TRABALHISTA - Feito Afeto x Maria Helena - 0010976-40.2026.5.03.0004 - Apresentar contrarrazões:2026-10-30T00:00:00:')
    expect(updates.some(u => u.google_event_id === 'g-novo')).toBe(true)
  })
  it('não duplica: se já há evento do mesmo processo no dia, só vincula', async () => {
    const { db, updates } = fakeDb(prazo)
    const { cal, chamadas } = fakeCal([{ id: 'g-antigo', summary: 'PRAZO - 0010976-40.2026.5.03.0004 - recurso' }])
    const r = await enviarCompromissoAoGoogle(db, cal, 'i1')
    expect(r).toMatchObject({ ok: true, acao: 'vinculado', eventoId: 'g-antigo' })
    expect(chamadas).toHaveLength(0)
    expect(updates.some(u => u.google_event_id === 'g-antigo')).toBe(true)
  })
  it('pula o horário ocupado da madrugada', async () => {
    const { db } = fakeDb(prazo)
    const { cal, chamadas } = fakeCal([{ id: 'x', summary: 'outro', start: { dateTime: '2026-10-30T00:00:00-03:00' }, end: { dateTime: '2026-10-30T00:10:00-03:00' } }])
    await enviarCompromissoAoGoogle(db, cal, 'i1')
    expect(chamadas[0]).toContain('2026-10-30T00:20:00')
  })
  it('audiência: horário real e amarelo (colorId 5)', async () => {
    const { db } = fakeDb({ ...prazo, tipo: 'audiencia', titulo: 'UNA PRESENCIAL', data_inicio: '2026-10-26', hora_inicio: '10:00:00', prazo_final: null })
    const { cal, chamadas } = fakeCal()
    await enviarCompromissoAoGoogle(db, cal, 'i1')
    expect(chamadas[0]).toContain('AUDIÊNCIA TRABALHISTA')
    expect(chamadas[0].endsWith('2026-10-26T10:00:00:5')).toBe(true)
  })
  it('tarefa comum não vai', async () => {
    const { db } = fakeDb({ ...prazo, tipo: 'tarefa' }); const { cal } = fakeCal()
    expect(await enviarCompromissoAoGoogle(db, cal, 'i1')).toMatchObject({ ok: false })
  })
})

describe('sincronizarAgendaGoogle', () => {
  it('sem data de ativação não envia nada (nada em massa)', async () => {
    const { db } = fakeDb(prazo); const { cal, chamadas } = fakeCal()
    const r = await sincronizarAgendaGoogle(db, cal, { desde: null })
    expect(r.desativado).toBeTruthy()
    expect(chamadas).toHaveLength(0)
  })
  it('apaga no Google o que foi excluído no PEDV', async () => {
    const { db, excluidos } = fakeDb(null, { fila: [{ id: 'f1', google_event_id: 'g9' }] }); const { cal, chamadas } = fakeCal()
    const r = await sincronizarAgendaGoogle(db, cal, { desde: '2026-10-23T00:00:00Z' })
    expect(r.apagados).toBe(1)
    expect(chamadas).toContain('apagar:g9')
    expect(excluidos).toEqual(['f1'])
  })
})
