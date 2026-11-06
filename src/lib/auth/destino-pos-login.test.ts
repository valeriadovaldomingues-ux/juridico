import { describe, expect, it } from 'vitest'
import { destinoAposLogin } from './destino-pos-login'

describe('destinoAposLogin', () => {
  it('volta para a autorização do conector, com os parâmetros', () => {
    expect(destinoAposLogin('/oauth/authorize?client_id=x&state=y')).toBe('/oauth/authorize?client_id=x&state=y')
    expect(destinoAposLogin('/oauth/authorize')).toBe('/oauth/authorize')
  })
  it('ignora qualquer outro destino', () => {
    expect(destinoAposLogin(null)).toBeNull()
    expect(destinoAposLogin('/dashboard')).toBeNull()
    expect(destinoAposLogin('//evil.example/oauth/authorize')).toBeNull()
    expect(destinoAposLogin('https://evil.example')).toBeNull()
    expect(destinoAposLogin('/oauth/authorizeX')).toBeNull()
    expect(destinoAposLogin('/oauth/authorize\\..')).toBeNull()
  })
})
