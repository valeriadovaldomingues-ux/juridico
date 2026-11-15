import { describe, expect, it } from 'vitest'
import { formatarDocumento, soDigitos, tipoPorTamanho, validarCnpj, validarCpf, validarDocumento } from './documento'

describe('validarCpf', () => {
  it('aceita CPFs válidos, com ou sem máscara', () => {
    expect(validarCpf('529.982.247-25')).toBe(true)
    expect(validarCpf('52998224725')).toBe(true)
    expect(validarCpf('111.444.777-35')).toBe(true)
  })
  it('recusa dígito verificador errado, tamanho errado e sequências repetidas', () => {
    expect(validarCpf('529.982.247-24')).toBe(false)
    expect(validarCpf('123')).toBe(false)
    expect(validarCpf('111.111.111-11')).toBe(false)
    expect(validarCpf('000.000.000-00')).toBe(false)
  })
})

describe('validarCnpj', () => {
  it('aceita CNPJs válidos, com ou sem máscara', () => {
    expect(validarCnpj('11.222.333/0001-81')).toBe(true)
    expect(validarCnpj('11444777000161')).toBe(true)
  })
  it('recusa dígito verificador errado, tamanho errado e sequências repetidas', () => {
    expect(validarCnpj('11.222.333/0001-82')).toBe(false)
    expect(validarCnpj('1122233300018')).toBe(false)
    expect(validarCnpj('00.000.000/0000-00')).toBe(false)
  })
})

describe('validarDocumento', () => {
  it('devolve dígitos e tipo', () => {
    expect(validarDocumento('529.982.247-25')).toEqual({ ok: true, documento: '52998224725', tipo: 'cpf' })
    expect(validarDocumento('11.222.333/0001-81')).toEqual({ ok: true, documento: '11222333000181', tipo: 'cnpj' })
  })
  it('explica o erro', () => {
    expect(validarDocumento('')).toMatchObject({ ok: false })
    expect(validarDocumento('12345')).toMatchObject({ ok: false, erro: expect.stringContaining('11 dígitos') })
    expect(validarDocumento('529.982.247-24')).toMatchObject({ ok: false, erro: expect.stringContaining('CPF inválido') })
    expect(validarDocumento('11.222.333/0001-82')).toMatchObject({ ok: false, erro: expect.stringContaining('CNPJ inválido') })
  })
})

describe('utilitários', () => {
  it('soDigitos / tipoPorTamanho / formatarDocumento', () => {
    expect(soDigitos('11.222.333/0001-81')).toBe('11222333000181')
    expect(soDigitos(null)).toBe('')
    expect(tipoPorTamanho('52998224725')).toBe('cpf')
    expect(tipoPorTamanho('11222333000181')).toBe('cnpj')
    expect(tipoPorTamanho('123')).toBeNull()
    expect(formatarDocumento('52998224725')).toBe('529.982.247-25')
    expect(formatarDocumento('11222333000181')).toBe('11.222.333/0001-81')
    expect(formatarDocumento('123')).toBe('123')
  })
})
