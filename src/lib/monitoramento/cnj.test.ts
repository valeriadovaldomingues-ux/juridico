import { describe, expect, it } from 'vitest'
import {
  formatarNumeroCNJ,
  normalizarNumeroCNJ,
  somenteDigitos,
  validarNumeroCNJ,
} from './cnj'

// Número real de publicação do DJEN (dígito verificador válido)
const CNJ_VALIDO_MASCARA = '3587182-05.2025.8.13.0000'
const CNJ_VALIDO_DIGITOS = '35871820520258130000'

describe('somenteDigitos', () => {
  it('remove máscara', () => {
    expect(somenteDigitos(CNJ_VALIDO_MASCARA)).toBe(CNJ_VALIDO_DIGITOS)
  })
})

describe('normalizarNumeroCNJ', () => {
  it('aceita número com máscara', () => {
    expect(normalizarNumeroCNJ(CNJ_VALIDO_MASCARA)).toBe(CNJ_VALIDO_DIGITOS)
  })

  it('aceita número já em dígitos', () => {
    expect(normalizarNumeroCNJ(CNJ_VALIDO_DIGITOS)).toBe(CNJ_VALIDO_DIGITOS)
  })

  it('rejeita quantidade de dígitos diferente de 20', () => {
    expect(normalizarNumeroCNJ('12345')).toBeNull()
    expect(normalizarNumeroCNJ('')).toBeNull()
  })
})

describe('formatarNumeroCNJ', () => {
  it('aplica a máscara padrão', () => {
    expect(formatarNumeroCNJ(CNJ_VALIDO_DIGITOS)).toBe(CNJ_VALIDO_MASCARA)
  })

  it('retorna null para entrada inválida', () => {
    expect(formatarNumeroCNJ('123')).toBeNull()
  })
})

describe('validarNumeroCNJ', () => {
  it('valida dígito verificador correto', () => {
    expect(validarNumeroCNJ(CNJ_VALIDO_MASCARA)).toBe(true)
  })

  it('rejeita dígito verificador incorreto', () => {
    expect(validarNumeroCNJ('3587182-06.2025.8.13.0000')).toBe(false)
  })

  it('rejeita formato inválido', () => {
    expect(validarNumeroCNJ('123')).toBe(false)
  })
})
