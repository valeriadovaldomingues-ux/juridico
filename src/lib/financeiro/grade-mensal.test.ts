import { describe, expect, it } from 'vitest'
import { mesesDoAno, proximoStatus, resolverCelula, resumirCelulas, somarMesYM } from './grade-mensal'

describe('grade mensal', () => {
  it('meses do ano e navegação', () => {
    expect(mesesDoAno(2026)).toHaveLength(12)
    expect(somarMesYM('2026-12', 1)).toBe('2027-01')
    expect(somarMesYM('2026-01', -1)).toBe('2025-12')
  })
  it('sem registro: atual e futuro valem o padrão pendente; passado fica sem registro', () => {
    expect(resolverCelula(1000, undefined, '2026-10', '2026-10')).toEqual({ valor: 1000, status: 'pendente', registrado: false })
    expect(resolverCelula(1000, undefined, '2027-02', '2026-10').status).toBe('pendente')
    expect(resolverCelula(1000, undefined, '2026-03', '2026-10').status).toBe('sem_registro')
  })
  it('com registro: usa o do mês; valor nulo cai no padrão', () => {
    expect(resolverCelula(1000, { valor: 1200, status: 'pago' }, '2026-03', '2026-10')).toEqual({ valor: 1200, status: 'pago', registrado: true })
    expect(resolverCelula(1000, { valor: null, status: 'vencido' }, '2026-03', '2026-10').valor).toBe(1000)
  })
  it('ciclo de status ao clicar', () => {
    expect(proximoStatus('sem_registro')).toBe('pago')
    expect(proximoStatus('pendente')).toBe('pago')
    expect(proximoStatus('pago')).toBe('vencido')
    expect(proximoStatus('vencido')).toBe('pendente')
  })
  it('resumo por status', () => {
    const r = resumirCelulas([
      { valor: 100, status: 'pago', registrado: true }, { valor: 50, status: 'pendente', registrado: false },
      { valor: 20, status: 'vencido', registrado: true }, { valor: 10, status: 'sem_registro', registrado: false },
    ])
    expect(r).toEqual({ total: 180, pago: 100, pendente: 50, vencido: 20, semRegistro: 10 })
  })
})
