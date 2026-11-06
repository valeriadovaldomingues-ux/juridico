import { describe, expect, it } from 'vitest'
import {
  ehAudienciaOuPericia, erroProcessoDaAudiencia, limparNumeroProcesso, normalizarCamposAudiencia,
  responsaveisDaAudiencia, rotuloStatusAudiencia,
} from './audiencia'

describe('audiência: regras e campos', () => {
  it('audiência e perícia exigem processo; os demais tipos não', () => {
    expect(ehAudienciaOuPericia('audiencia')).toBe(true)
    expect(ehAudienciaOuPericia('pericia')).toBe(true)
    expect(ehAudienciaOuPericia('prazo')).toBe(false)
    expect(erroProcessoDaAudiencia('audiencia', null)).toMatch(/ligadas a um processo/)
    expect(erroProcessoDaAudiencia('pericia', '')).toMatch(/ligadas a um processo/)
    expect(erroProcessoDaAudiencia('audiencia', 'proc-1')).toBeNull()
    expect(erroProcessoDaAudiencia('tarefa', null)).toBeNull()
  })
  it('traduz o status para a pauta', () => {
    expect(rotuloStatusAudiencia('pendente')).toBe('Aberta')
    expect(rotuloStatusAudiencia('cancelado')).toBe('Cancelada')
    expect(rotuloStatusAudiencia('concluido')).toBe('Realizada')
    expect(rotuloStatusAudiencia(null)).toBe('Aberta')
  })
  it('separa os até 2 responsáveis', () => {
    expect(responsaveisDaAudiencia('Valéria / Débora')).toEqual(['Valéria', 'Débora'])
    expect(responsaveisDaAudiencia('Valéria')).toEqual(['Valéria'])
    expect(responsaveisDaAudiencia(null)).toEqual([])
    expect(responsaveisDaAudiencia('A / B / C')).toEqual(['A', 'B'])
  })
  it('limpa o número do processo importado com aspas', () => {
    expect(limparNumeroProcesso('"0011393-89.2026.5.03.0069"')).toBe('0011393-89.2026.5.03.0069')
    expect(limparNumeroProcesso('  ')).toBeNull()
    expect(limparNumeroProcesso(null)).toBeNull()
  })
  it('normaliza tipo, modalidade e local; valor desconhecido vira null', () => {
    expect(normalizarCamposAudiencia({ audiencia_tipo: 'una', audiencia_modalidade: 'virtual', audiencia_local: ' https://zoom.us/x ' }))
      .toEqual({ audiencia_tipo: 'una', audiencia_modalidade: 'virtual', audiencia_local: 'https://zoom.us/x' })
    expect(normalizarCamposAudiencia({ audiencia_tipo: 'qualquer', audiencia_modalidade: 'x', audiencia_local: '   ' }))
      .toEqual({ audiencia_tipo: null, audiencia_modalidade: null, audiencia_local: null })
    expect(normalizarCamposAudiencia({})).toEqual({ audiencia_tipo: null, audiencia_modalidade: null, audiencia_local: null })
  })
})
