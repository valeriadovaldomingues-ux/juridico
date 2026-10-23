import { describe, expect, it } from 'vitest'
import { corpoReciboAdvogado, corpoReciboBeneficio, corpoReciboSalario, gerarReciboPdfBytes, quebrarEmLinhas, unidadesDoRecibo, type DadosPessoais } from './pdf'

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

describe('recibo: negrito nos nomes', () => {
  it('o nome de quem assina e o escritório vêm marcados em negrito', () => {
    const t = corpoReciboSalario(luana, 3242, '2026-09-01')
    expect(t).toContain('**Luana Maria de Souza**')
    expect(t).toContain('**PESSOA E DO VAL ADVOCACIA**')
  })

  it('unidadesDoRecibo separa negrito de texto normal e cola a pontuação ao nome, sem espaço', () => {
    const u = unidadesDoRecibo('Eu, **Luana Maria**, recebi de **PESSOA E DO VAL**.')
    // "Maria" + "," ficam juntos; "VAL" + "." também
    expect(u.map(x => x.map(p => p.texto).join(''))).toEqual(['Eu,', 'Luana', 'Maria,', 'recebi', 'de', 'PESSOA', 'E', 'DO', 'VAL.'])
    const maria = u[2]
    expect(maria).toEqual([{ texto: 'Maria', negrito: true }, { texto: ',', negrito: false }])
  })

  it('estado civil do advogado sai no texto (divorciado)', () => {
    const breno = { ...luana, nomeCompleto: 'Breno Queiroz de Andrade', nacionalidade: 'brasileiro', estadoCivil: 'divorciado', oabNumero: '123' } as DadosPessoais
    expect(corpoReciboAdvogado(breno, 1000, '2026-09-01')).toContain('brasileiro, divorciado')
  })
})

describe('recibo: texto justificado', () => {
  const medir = (u: { texto: string }[]) => u.reduce((a, p) => a + p.texto.length * 6, 0)
  const palavras = Array.from({ length: 40 }, (_, i) => [{ texto: `palavra${i}`, negrito: false }])

  it('quebra em linhas que cabem na largura e marca a última', () => {
    const linhas = quebrarEmLinhas(palavras, 300, medir, 3)
    expect(linhas.length).toBeGreaterThan(1)
    for (const l of linhas) {
      const w = l.unidades.reduce((a, u) => a + medir(u), 0) + (l.unidades.length - 1) * 3
      expect(w).toBeLessThanOrEqual(300)
    }
    expect(linhas.filter(l => l.ultima)).toHaveLength(1)
    expect(linhas[linhas.length - 1].ultima).toBe(true)
  })

  it('gera o PDF sem erro, com negrito e justificado', async () => {
    const bytes = await gerarReciboPdfBytes({ corpo: corpoReciboSalario(luana, 3242, '2026-09-01'), nomeAssinante: luana.nomeCompleto, mesReferencia: '2026-09-01' })
    expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe('%PDF')
    expect(bytes.length).toBeGreaterThan(1000)
  })
})
