import { describe, expect, it } from 'vitest'
import { montarAuthorizationDataJud } from './datajud'

describe('DataJud CNJ', () => {
  it('monta Authorization com prefixo APIKey quando a chave vem sem prefixo', () => {
    expect(montarAuthorizationDataJud('segredo')).toBe('APIKey segredo')
  })

  it('não duplica o prefixo APIKey quando a variável já vem completa', () => {
    expect(montarAuthorizationDataJud('APIKey segredo')).toBe('APIKey segredo')
  })

  it('retorna null quando não há chave configurada', () => {
    expect(montarAuthorizationDataJud('')).toBeNull()
  })
})
