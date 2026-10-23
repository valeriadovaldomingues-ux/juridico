import { describe, expect, it } from 'vitest'
import { ADVOGADO_RESPONSAVEL_ID, quemCuidaOuResponsavel } from './responsavel'

describe('quemCuidaOuResponsavel', () => {
  it('prefere quem cuida do caso', () => {
    expect(quemCuidaOuResponsavel({ advogado_caso_id: 'debora', advogado_responsavel_id: ADVOGADO_RESPONSAVEL_ID })).toBe('debora')
  })
  it('sem ninguém cuidando, cai na responsável', () => {
    expect(quemCuidaOuResponsavel({ advogado_caso_id: null, advogado_responsavel_id: ADVOGADO_RESPONSAVEL_ID })).toBe(ADVOGADO_RESPONSAVEL_ID)
    expect(quemCuidaOuResponsavel({})).toBeNull()
  })
})
