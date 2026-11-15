import { describe, expect, it } from 'vitest'
import { cnpjValido, cpfValido, documentoParcial, mascararDocumento, normalizarDocumento, somenteDigitos } from './documento'

describe('CPF/CNPJ do portal', () => {
  it('só dígitos', () => {
    expect(somenteDigitos('529.982.247-25')).toBe('52998224725')
    expect(somenteDigitos('11.222.333/0001-81')).toBe('11222333000181')
  })

  it('valida CPF por dígito verificador', () => {
    expect(cpfValido('52998224725')).toBe(true)
    expect(cpfValido('52998224724')).toBe(false)
    expect(cpfValido('11111111111')).toBe(false) // todos iguais
    expect(cpfValido('123')).toBe(false)
  })

  it('valida CNPJ por dígito verificador', () => {
    expect(cnpjValido('11222333000181')).toBe(true)
    expect(cnpjValido('11222333000182')).toBe(false)
    expect(cnpjValido('00000000000000')).toBe(false)
  })

  it('normaliza com ou sem máscara e informa o tipo', () => {
    expect(normalizarDocumento('529.982.247-25')).toEqual({ ok: true, digitos: '52998224725', tipo: 'cpf' })
    expect(normalizarDocumento('52998224725')).toEqual({ ok: true, digitos: '52998224725', tipo: 'cpf' })
    expect(normalizarDocumento('11.222.333/0001-81')).toEqual({ ok: true, digitos: '11222333000181', tipo: 'cnpj' })
  })

  it('rejeita entrada inválida (dígito errado, tamanho, tipo, lixo)', () => {
    expect(normalizarDocumento('529.982.247-24').ok).toBe(false)
    expect(normalizarDocumento('1234567890').ok).toBe(false)
    expect(normalizarDocumento(undefined).ok).toBe(false)
    expect(normalizarDocumento({ a: 1 }).ok).toBe(false)
    expect(normalizarDocumento('x'.repeat(500)).ok).toBe(false)
    // texto estranho é descartado: só os dígitos seguem adiante (nada de SQL/pontuação chega ao banco)
    const r = normalizarDocumento("52998224725'; drop table clientes;--")
    expect(r.ok && /^\d+$/.test(r.digitos)).toBe(true)
  })

  it('máscara de digitação (CPF e CNPJ)', () => {
    expect(mascararDocumento('52998224725')).toBe('529.982.247-25')
    expect(mascararDocumento('11222333000181')).toBe('11.222.333/0001-81')
    expect(mascararDocumento('5299')).toBe('529.9')
  })

  it('documentoParcial mostra só os 2 últimos dígitos', () => {
    expect(documentoParcial('52998224725')).toMatch(/25$/)
    expect(documentoParcial('52998224725')).not.toContain('529')
  })
})
