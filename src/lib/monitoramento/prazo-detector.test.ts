import { describe, expect, it } from 'vitest'
import { detectarPrazosEAudiencias } from './prazo-detector'

describe('detectarPrazosEAudiencias — atos que abrem prazo sem número de dias', () => {
  it('remessa "para apresentar resposta ao recurso" é detectada como prazo', () => {
    const r = detectarPrazosEAudiencias('Remetam-se os autos à parte recorrida para apresentar resposta ao recurso ordinário interposto.')
    expect(r.prazo_detectado).toBe(true)
  })
  it('"intimado para se manifestar" e "vista à parte contrária" também', () => {
    expect(detectarPrazosEAudiencias('Fica o reclamante intimado para se manifestar sobre os documentos.').prazo_detectado).toBe(true)
    expect(detectarPrazosEAudiencias('Dê-se vista à reclamada sobre os cálculos.').prazo_detectado).toBe(true)
  })
  it('continua pegando o prazo com dias e extraindo o número', () => {
    const r = detectarPrazosEAudiencias('Intime-se para manifestação no prazo de 8 (oito) dias.')
    expect(r.prazo_detectado).toBe(true)
    expect(r.prazo_dias).toBe(8)
  })
  it('texto sem ato nem prazo não dispara', () => {
    expect(detectarPrazosEAudiencias('Juntada de petição de substabelecimento. Anote-se.').prazo_detectado).toBe(false)
  })
})
