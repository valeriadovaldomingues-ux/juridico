import { test } from 'vitest'
import assert from 'node:assert/strict'
import { calcularDecenio } from '../src/types/inpi'

function isoDaysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

test('decenio ainda distante não entra em nenhuma janela de alerta', () => {
  // Concessão há 2 anos: faltam 8 anos pro vencimento.
  const dataConcessao = isoDaysFromNow(-2 * 365)
  const info = calcularDecenio(dataConcessao)
  assert.equal(info.expirado, false)
  assert.equal(info.janelaRenovacao, false)
  assert.equal(info.janelaMulta, false)
  assert.ok(info.diasRestantes > 365 * 7)
})

test('decenio no último ano de vigência entra na janela de renovação', () => {
  // Concessão há 9 anos e 3 meses: falta menos de 1 ano pro vencimento.
  const dataConcessao = isoDaysFromNow(-(9 * 365 + 90))
  const info = calcularDecenio(dataConcessao)
  assert.equal(info.expirado, false)
  assert.equal(info.janelaRenovacao, true)
  assert.equal(info.janelaMulta, false)
})

test('decenio vencido há pouco tempo entra na janela de multa (até 6 meses)', () => {
  // Concessão há 10 anos e 2 meses: venceu há 2 meses.
  const dataConcessao = isoDaysFromNow(-(10 * 365 + 60))
  const info = calcularDecenio(dataConcessao)
  assert.equal(info.expirado, false)
  assert.equal(info.janelaRenovacao, false)
  assert.equal(info.janelaMulta, true)
  assert.ok(info.diasRestantes < 0)
})

test('decenio vencido há mais de 6 meses é considerado expirado', () => {
  // Concessão há 10 anos e 8 meses: passou da janela de multa.
  const dataConcessao = isoDaysFromNow(-(10 * 365 + 8 * 30))
  const info = calcularDecenio(dataConcessao)
  assert.equal(info.expirado, true)
  assert.equal(info.janelaRenovacao, false)
  assert.equal(info.janelaMulta, false)
})

test('vencimento é sempre exatamente 10 anos após a concessão', () => {
  const info = calcularDecenio('2020-03-15')
  assert.equal(info.vencimento.getFullYear(), 2030)
  assert.equal(info.vencimento.getMonth(), 2) // março (0-indexed)
  assert.equal(info.vencimento.getDate(), 15)
})
