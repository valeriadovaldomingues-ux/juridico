import { describe, expect, it } from 'vitest'
import { escolherHorarioPrazo, eventoJaExiste, extrairLocal, hashEvento, montarEvento, tipoVaiParaGoogle, tituloEvento } from './agenda-evento'

const ctxTrab = { numero_processo: '0010976-40.2026.5.03.0004', area_direito: 'trabalhista', cliente: 'Feito Afeto', parteContraria: 'Maria Helena' }

describe('título do evento', () => {
  it('prazo trabalhista: PRAZO TRABALHISTA - Cliente x Parte - nº - ato', () => {
    expect(tituloEvento({ id: '1', titulo: 'Apresentar contrarrazões', tipo: 'prazo', data_inicio: '2026-10-30' }, ctxTrab))
      .toBe('PRAZO TRABALHISTA - Feito Afeto x Maria Helena - 0010976-40.2026.5.03.0004 - Apresentar contrarrazões')
  })
  it('prazo cível: PRAZO! ATO - Cliente x Parte - nº', () => {
    expect(tituloEvento({ id: '1', titulo: 'Réplica', tipo: 'prazo', data_inicio: '2026-10-30' }, { ...ctxTrab, area_direito: 'civil' }))
      .toBe('PRAZO! RÉPLICA - Feito Afeto x Maria Helena - 0010976-40.2026.5.03.0004')
  })
  it('audiência trabalhista', () => {
    expect(tituloEvento({ id: '1', titulo: 'UNA PRESENCIAL (conciliação + instrução + julgamento)', tipo: 'audiencia', data_inicio: '2026-10-26' }, ctxTrab))
      .toBe('AUDIÊNCIA TRABALHISTA - Feito Afeto x Maria Helena - 0010976-40.2026.5.03.0004 - UNA PRESENCIAL (conciliação + instrução + julgamento)')
  })
  it('a parte do compromisso vence a do processo', () => {
    expect(tituloEvento({ id: '1', titulo: 'x', tipo: 'prazo', data_inicio: '2026-10-30', opposing_party_name: 'Outra' }, ctxTrab)).toContain('Feito Afeto x Outra')
  })
})

describe('evento', () => {
  it('só prazo e audiência/perícia vão; tarefa não', () => {
    expect(tipoVaiParaGoogle('tarefa')).toBeNull()
    expect(tipoVaiParaGoogle('evento')).toBeNull()
    expect(tipoVaiParaGoogle('prazo')).toBe('prazo')
    expect(tipoVaiParaGoogle('pericia')).toBe('audiencia')
    expect('erro' in montarEvento({ id: '1', titulo: 't', tipo: 'tarefa', data_inicio: '2026-10-30' }, ctxTrab)).toBe(true)
  })
  it('audiência: horário real, 1 hora, amarelo, link no location', () => {
    const e = montarEvento({ id: '1', titulo: 'Una', tipo: 'audiencia', data_inicio: '2026-10-26', hora_inicio: '10:00:00', descricao: 'Sala virtual: https://trt3.zoom.us/j/123?pwd=abc.' }, ctxTrab)
    expect(e).toMatchObject({ colorId: '5', duracaoMin: 60, location: 'https://trt3.zoom.us/j/123?pwd=abc', start: { dateTime: '2026-10-26T10:00:00' }, end: { dateTime: '2026-10-26T11:00:00' } })
  })
  it('audiência sem horário: erro; prazo: sem cor e 10 min, no dia do prazo final', () => {
    expect('erro' in montarEvento({ id: '1', titulo: 'Una', tipo: 'audiencia', data_inicio: '2026-10-26' }, ctxTrab)).toBe(true)
    const p = montarEvento({ id: '1', titulo: 'x', tipo: 'prazo', data_inicio: '2026-10-20', prazo_final: '2026-10-30' }, ctxTrab)
    expect(p).toMatchObject({ modo: 'prazo', dia: '2026-10-30', duracaoMin: 10 })
    expect((p as { colorId?: string }).colorId).toBeUndefined()
  })
  it('extrai local por linha "Local:"', () => {
    expect(extrairLocal({ descricao: 'Local: Av. Augusto de Lima, 1234 - Vara 4' })).toBe('Av. Augusto de Lima, 1234 - Vara 4')
    expect(extrairLocal({ descricao: 'sem local' })).toBeUndefined()
  })
})

describe('horário do prazo na madrugada', () => {
  it('dia vazio: 00:00–00:10', () => expect(escolherHorarioPrazo([])).toEqual({ inicio: '00:00', fim: '00:10' }))
  it('pula o que já está ocupado, respeitando 5 min de folga e os minutos :00/:20/:40', () => {
    expect(escolherHorarioPrazo([{ inicio: '00:00', fim: '00:10' }])).toEqual({ inicio: '00:20', fim: '00:30' })
    expect(escolherHorarioPrazo([{ inicio: '00:00', fim: '00:10' }, { inicio: '00:20', fim: '00:30' }, { inicio: '00:40', fim: '00:50' }])).toEqual({ inicio: '01:00', fim: '01:10' })
  })
  it('o início é sempre :00, :20 ou :40', () => {
    const ocupados = Array.from({ length: 6 }, (_, i) => ({ inicio: `0${i}:00`, fim: `0${i}:12` }))
    const h = escolherHorarioPrazo(ocupados)
    expect(h && ['00', '20', '40'].includes(h.inicio.slice(3))).toBe(true)
  })
})

describe('duplicidade e hash', () => {
  it('acha evento do mesmo número (com ou sem pontuação)', () => {
    expect(eventoJaExiste([{ id: 'g1', summary: 'PRAZO - 0010976-40.2026.5.03.0004 - x' }], '0010976-40.2026.5.03.0004')).toEqual({ id: 'g1' })
    expect(eventoJaExiste([{ id: 'g1', description: 'proc 00109764020265030004' }], '0010976-40.2026.5.03.0004')).toEqual({ id: 'g1' })
    expect(eventoJaExiste([{ id: 'g1', summary: 'outro' }], '0010976-40.2026.5.03.0004')).toBeNull()
    expect(eventoJaExiste([{ id: 'g1', summary: 'qualquer' }], null)).toBeNull()
  })
  it('hash muda quando o texto muda', () => {
    const a = { summary: 'A', description: 'd', dia: '2026-10-30', modo: 'prazo' as const }
    expect(hashEvento(a)).toBe(hashEvento({ ...a }))
    expect(hashEvento(a)).not.toBe(hashEvento({ ...a, summary: 'B' }))
  })
})
