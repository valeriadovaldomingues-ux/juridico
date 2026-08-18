import { describe, expect, it } from 'vitest'
import { chaveOAB, formatarOAB, mesmaOAB, normalizarOAB } from './oab'

describe('normalizarOAB', () => {
  it('reconhece o formato OAB/MG 123.456', () => {
    expect(normalizarOAB('OAB/MG 123.456')).toEqual({ numero: '123456', uf: 'MG' })
  })

  it('reconhece o formato MG123456', () => {
    expect(normalizarOAB('MG123456')).toEqual({ numero: '123456', uf: 'MG' })
  })

  it('reconhece o formato 123456-MG', () => {
    expect(normalizarOAB('123456-MG')).toEqual({ numero: '123456', uf: 'MG' })
  })

  it('reconhece o formato 123.456/SP', () => {
    expect(normalizarOAB('123.456/SP')).toEqual({ numero: '123456', uf: 'SP' })
  })

  it('não confunde as letras de "OAB" com UF', () => {
    expect(normalizarOAB('OAB 98185', 'MG')).toEqual({ numero: '98185', uf: 'MG' })
  })

  it('remove zeros à esquerda do número', () => {
    expect(normalizarOAB('OAB/MG 098185')).toEqual({ numero: '98185', uf: 'MG' })
  })

  it('usa a UF padrão quando o texto não traz UF', () => {
    expect(normalizarOAB('123456', 'RJ')).toEqual({ numero: '123456', uf: 'RJ' })
  })

  it('retorna null sem número', () => {
    expect(normalizarOAB('OAB/MG')).toBeNull()
    expect(normalizarOAB('')).toBeNull()
  })

  it('retorna null sem UF determinável', () => {
    expect(normalizarOAB('123456')).toBeNull()
  })

  it('ignora sequência de letras que não é UF válida', () => {
    expect(normalizarOAB('XY 123456', 'MG')).toEqual({ numero: '123456', uf: 'MG' })
  })
})

describe('mesmaOAB', () => {
  it('trata formatos diferentes como o mesmo registro', () => {
    expect(mesmaOAB('OAB/MG 123.456', 'MG123456')).toBe(true)
    expect(mesmaOAB('123456-MG', 'OAB MG 123456')).toBe(true)
  })

  it('diferencia UFs distintas', () => {
    expect(mesmaOAB('OAB/MG 123456', 'OAB/SP 123456')).toBe(false)
  })

  it('diferencia números distintos', () => {
    expect(mesmaOAB('OAB/MG 123456', 'OAB/MG 654321')).toBe(false)
  })
})

describe('chaveOAB / formatarOAB', () => {
  it('gera chave canônica e formato de exibição', () => {
    const oab = normalizarOAB('123.456/MG')!
    expect(chaveOAB(oab)).toBe('MG123456')
    expect(formatarOAB(oab)).toBe('OAB/MG 123456')
  })
})
