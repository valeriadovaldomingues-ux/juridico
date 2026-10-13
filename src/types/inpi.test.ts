import { describe, expect, it } from 'vitest'
import { calcularDecenio } from './inpi'

// Caso real da tela do INPI: concessão 08/08/2017, prorrogação deferida em 06/10/2026.
// INPI: prazo ordinário 09/08/2036 a 08/08/2037; extraordinário até 08/02/2038.
describe('calcularDecenio com prorrogações', () => {
  const hoje = new Date('2026-10-13T12:00:00')

  it('sem prorrogação, vence 10 anos depois da concessão', () => {
    const d = calcularDecenio('2017-08-08', 0, hoje)
    expect(d.vencimento.toISOString().slice(0, 10)).toBe('2027-08-08')
    expect(d.janelaRenovacao).toBe(true) // a janela ordinária abriu em 08/08/2026: sem a prorrogação o sistema mandaria "renovar"
  })

  it('com 1 prorrogação, a vigência vai a 2037 e já não está na janela de renovação', () => {
    const d = calcularDecenio('2017-08-08', 1, hoje)
    expect(d.vencimento.toISOString().slice(0, 10)).toBe('2037-08-08')
    expect(d.janelaRenovacao).toBe(false)
    expect(d.janelaMulta).toBe(false)
    expect(d.expirado).toBe(false)
  })

  it('janela ordinária abre 1 ano antes e a extraordinária vai 6 meses depois do vencimento', () => {
    const dentro = calcularDecenio('2017-08-08', 1, new Date('2036-09-01T12:00:00'))
    expect(dentro.janelaRenovacao).toBe(true)
    const multa = calcularDecenio('2017-08-08', 1, new Date('2037-12-01T12:00:00'))
    expect(multa.janelaMulta).toBe(true)
    const fora = calcularDecenio('2017-08-08', 1, new Date('2038-03-01T12:00:00'))
    expect(fora.expirado).toBe(true)
  })

  it('prorrogações negativas são tratadas como zero', () => {
    expect(calcularDecenio('2017-08-08', -3, hoje).vencimento.getFullYear()).toBe(2027)
  })
})
