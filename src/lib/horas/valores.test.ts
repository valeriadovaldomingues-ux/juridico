import { describe, expect, it } from 'vitest'
import { podeVerValorHoras, semValorDeHoras } from './valores'

describe('valor das horas só para sócio', () => {
  const entrada = { id: '1', valor_hora: 300, valor_total: 450, descricao_atividade: 'x' }

  it('só sócio vê', () => {
    expect(podeVerValorHoras('socio')).toBe(true)
    for (const r of ['gerente', 'advogado', 'administrativo', 'estagiario', 'comercial', 'cliente', null, undefined]) expect(podeVerValorHoras(r)).toBe(false)
  })
  it('sócio recebe o lançamento intacto', () => {
    expect(semValorDeHoras('socio', entrada)).toEqual(entrada)
  })
  it('os demais recebem sem os valores, mantendo o resto', () => {
    expect(semValorDeHoras('advogado', entrada)).toEqual({ id: '1', valor_hora: null, valor_total: null, descricao_atividade: 'x' })
    expect(semValorDeHoras('gerente', [entrada, entrada]).every(e => e.valor_hora === null && e.valor_total === null)).toBe(true)
  })
  it('não altera o objeto original', () => {
    semValorDeHoras('advogado', entrada)
    expect(entrada.valor_total).toBe(450)
  })
})
