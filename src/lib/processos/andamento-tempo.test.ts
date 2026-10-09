import { describe, it, expect } from 'vitest'
import { normalizarTempo, dataHoraBrasilia } from './andamento-tempo'

const AGORA = '2026-10-08T17:00:00.000Z'

describe('normalizarTempo', () => {
  it('sem bloco de tempo (ou vazio) não cria nada', () => {
    expect(normalizarTempo(undefined, AGORA)).toBeNull()
    expect(normalizarTempo({}, AGORA)).toBeNull()
    expect(normalizarTempo({ inicio_em: '', fim_em: '', duracao_minutos: null }, AGORA)).toBeNull()
  })

  it('início e fim: calcula os minutos', () => {
    const r = normalizarTempo({ inicio_em: '2026-10-08T13:00:00-03:00', fim_em: '2026-10-08T14:30:00-03:00' }, AGORA)
    expect(r).toMatchObject({ ok: true, tempo: { minutos: 90, usa_duracao_manual: false, fim_em: expect.any(String), cobravel: true } })
  })

  it('só a duração: usa duração manual, a partir da data do andamento', () => {
    const r = normalizarTempo({ duracao_minutos: 75, cobravel: false }, AGORA)
    expect(r).toMatchObject({ ok: true, tempo: { minutos: 75, usa_duracao_manual: true, duracao_manual_minutos: 75, fim_em: null, inicio_em: AGORA, cobravel: false } })
  })

  it('rejeita fim antes do início, duração zero e mais de 24h', () => {
    expect(normalizarTempo({ inicio_em: '2026-10-08T14:00:00Z', fim_em: '2026-10-08T13:00:00Z' }, AGORA)).toMatchObject({ ok: false })
    expect(normalizarTempo({ duracao_minutos: 0 }, AGORA)).toMatchObject({ ok: false })
    expect(normalizarTempo({ duracao_minutos: 24 * 60 + 1 }, AGORA)).toMatchObject({ ok: false })
    expect(normalizarTempo({ inicio_em: '2026-10-08T00:00:00Z', fim_em: '2026-10-10T00:00:00Z' }, AGORA)).toMatchObject({ ok: false })
  })

  it('só o início, sem fim nem duração, pede o resto', () => {
    expect(normalizarTempo({ inicio_em: '2026-10-08T13:00:00Z' }, AGORA)).toMatchObject({ ok: false })
  })
})

describe('dataHoraBrasilia', () => {
  it('converte para o horário de Brasília', () => {
    expect(dataHoraBrasilia('2026-10-08T17:30:00.000Z')).toEqual({ data: '2026-10-08', hora: '14:30' })
    expect(dataHoraBrasilia('2026-10-09T02:15:00.000Z')).toEqual({ data: '2026-10-08', hora: '23:15' })
  })
})
