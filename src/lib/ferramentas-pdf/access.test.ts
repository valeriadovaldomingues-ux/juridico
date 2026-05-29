import { describe, expect, it } from 'vitest'
import { canAccessFerramentasPdf } from './access'

describe('Ferramentas PDF access', () => {
  it('permite usuários internos autenticados', () => {
    expect(canAccessFerramentasPdf('socio')).toBe(true)
    expect(canAccessFerramentasPdf('gerente')).toBe(true)
    expect(canAccessFerramentasPdf('advogado')).toBe(true)
    expect(canAccessFerramentasPdf('administrativo')).toBe(true)
    expect(canAccessFerramentasPdf('estagiario')).toBe(true)
    expect(canAccessFerramentasPdf('comercial')).toBe(true)
  })

  it('bloqueia cliente e ausência de role', () => {
    expect(canAccessFerramentasPdf('cliente')).toBe(false)
    expect(canAccessFerramentasPdf(null)).toBe(false)
    expect(canAccessFerramentasPdf(undefined)).toBe(false)
  })
})
