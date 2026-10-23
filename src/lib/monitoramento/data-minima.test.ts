import { describe, expect, it } from 'vitest'
import { publicacaoAnteriorADataMinima } from './data-minima'

describe('publicacaoAnteriorADataMinima', () => {
  const min = '2026-10-13'
  it('ignora o que é anterior à data mínima, em ISO ou DD/MM/AAAA', () => {
    expect(publicacaoAnteriorADataMinima('2026-10-12', min)).toBe(true)
    expect(publicacaoAnteriorADataMinima('2026-08-03T00:00:00Z', min)).toBe(true)
    expect(publicacaoAnteriorADataMinima('12/10/2026', min)).toBe(true)
  })
  it('aceita hoje e o futuro', () => {
    expect(publicacaoAnteriorADataMinima('2026-10-13', min)).toBe(false)
    expect(publicacaoAnteriorADataMinima('13/10/2026', min)).toBe(false)
    expect(publicacaoAnteriorADataMinima('2026-12-01', min)).toBe(false)
  })
  it('data ilegível ou vazia não é descartada', () => {
    expect(publicacaoAnteriorADataMinima('', min)).toBe(false)
    expect(publicacaoAnteriorADataMinima(null, min)).toBe(false)
    expect(publicacaoAnteriorADataMinima('ontem', min)).toBe(false)
  })
})
