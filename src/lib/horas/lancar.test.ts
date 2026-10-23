import { describe, expect, it } from 'vitest'
import { lerTempo } from './lancar'

describe('lerTempo', () => {
  it('início e fim: calcula os minutos e usa o fuso de Brasília', () => {
    const r = lerTempo({ data: '2026-10-23', modo: 'periodo', inicio: '09:30', fim: '11:00' })
    expect(r).toMatchObject({ ok: true, tempo: { inicio_em: '2026-10-23T09:30:00-03:00', fim_em: '2026-10-23T11:00:00-03:00', minutos: 90, usa_duracao_manual: false } })
  })
  it('fim antes do início ou igual: erro', () => {
    expect(lerTempo({ data: '2026-10-23', modo: 'periodo', inicio: '11:00', fim: '09:00' }).ok).toBe(false)
    expect(lerTempo({ data: '2026-10-23', modo: 'periodo', inicio: '09:00', fim: '09:00' }).ok).toBe(false)
  })
  it('duração: horas e minutos, marcado ao meio-dia', () => {
    const r = lerTempo({ data: '2026-10-23', modo: 'duracao', horas: 1, minutos: 30 })
    expect(r).toMatchObject({ ok: true, tempo: { inicio_em: '2026-10-23T12:00:00-03:00', fim_em: null, duracao_manual_minutos: 90, usa_duracao_manual: true, minutos: 90 } })
  })
  it('recusa duração zero, minutos > 59, data inválida e hora inválida', () => {
    expect(lerTempo({ data: '2026-10-23', modo: 'duracao', horas: 0, minutos: 0 }).ok).toBe(false)
    expect(lerTempo({ data: '2026-10-23', modo: 'duracao', horas: 1, minutos: 75 }).ok).toBe(false)
    expect(lerTempo({ data: '23/10/2026', modo: 'duracao', horas: 1 }).ok).toBe(false)
    expect(lerTempo({ data: '2026-10-23', modo: 'periodo', inicio: '25:00', fim: '26:00' }).ok).toBe(false)
  })
})
