import { describe, expect, it } from 'vitest'
import {
  assertKnownOperation,
  assertMyAiDriveSocioAccess,
  assertSafePath,
  assertSafeSearchQuery,
} from '../guards'

describe('My AI Drive guards', () => {
  it('bloqueia cliente e qualquer perfil não socio', () => {
    expect(() => assertMyAiDriveSocioAccess('cliente' as never)).toThrow('restrita a sócios')
    expect(() => assertMyAiDriveSocioAccess('gerente' as never)).toThrow('restrita a sócios')
    expect(() => assertMyAiDriveSocioAccess(null)).toThrow('restrita a sócios')
  })

  it('permite socio', () => {
    expect(() => assertMyAiDriveSocioAccess('socio')).not.toThrow()
  })

  it('valida operação conhecida', () => {
    expect(() => assertKnownOperation('search_files')).not.toThrow()
    expect(() => assertKnownOperation('operation_inventada')).toThrow('desconhecida')
  })

  it('valida consulta e bloqueia query curta', () => {
    expect(() => assertSafeSearchQuery('ab')).not.toThrow()
    expect(() => assertSafeSearchQuery('a')).toThrow('pelo menos 2')
  })

  it('bloqueia path traversal', () => {
    expect(() => assertSafePath('/pasta/arquivo.pdf')).not.toThrow()
    expect(() => assertSafePath('../segredo')).toThrow('não é permitido')
    expect(() => assertSafePath('https://malicioso.com/arquivo')).toThrow('não é permitido')
  })
})
