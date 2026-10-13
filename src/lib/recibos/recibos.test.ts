import { describe, expect, it } from 'vitest'
import { corpoReciboBeneficio, corpoReciboSalario, type DadosPessoais } from './pdf'

const luana: DadosPessoais = {
  nomeCompleto: 'Luana Maria de Souza', nacionalidade: 'brasileira', estadoCivil: 'solteira',
  cpf: '000.000.000-00', rg: null, oabNumero: null, oabSecao: null, endereco: 'Rua A, 10, Belo Horizonte/MG',
} as DadosPessoais

describe('recibos da Luana (CLT): salário, alimentação e transporte em recibos separados', () => {
  it('recibo de salário cita só o salário e o mês, sem benefícios', () => {
    const t = corpoReciboSalario(luana, 3242, '2026-09-01')
    expect(t).toContain('Luana Maria de Souza')
    expect(t).toContain('referente ao salário do mês de')
    expect(t).toContain('2026')
    expect(t).not.toMatch(/transporte|aliment/i)
  })

  it('com extra/gratificação o texto diz "salário e demais verbas"', () => {
    expect(corpoReciboSalario(luana, 3742, '2026-09-01', true)).toContain('referente ao salário e demais verbas do mês de')
  })

  it('recibos de transporte e de alimentação continuam separados, cada um com o seu valor', () => {
    expect(corpoReciboBeneficio(luana, 262.5, '2026-09-01', 'transporte')).toMatch(/referente ao transporte/)
    expect(corpoReciboBeneficio(luana, 630, '2026-09-01', 'alimentacao')).toMatch(/referente ao auxílio alimentação/)
  })
})
