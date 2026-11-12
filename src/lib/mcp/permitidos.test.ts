import { describe, expect, it } from 'vitest'
import { usuarioPodeEscreverMcp, usuarioPodeMcp } from './permitidos'

describe('liberação do conector', () => {
  it('libera todo advogado, gerente e estagiário, para consultar e para gravar', () => {
    for (const role of ['advogado', 'gerente', 'estagiario']) {
      expect(usuarioPodeMcp('qualquer-id', role)).toBe(true)
      expect(usuarioPodeEscreverMcp('qualquer-id', role)).toBe(true)
    }
  })
  it('não libera os outros papéis, nem sem papel', () => {
    for (const role of ['administrativo', 'comercial', 'cliente', 'socio', undefined, null]) {
      expect(usuarioPodeMcp('qualquer-id', role)).toBe(false)
      expect(usuarioPodeEscreverMcp('qualquer-id', role)).toBe(false)
    }
    expect(usuarioPodeMcp(null, 'advogado')).toBe(false)
  })
  it('mantém a liberação individual (lista) mesmo sem o papel', () => {
    expect(usuarioPodeMcp('dd154172-ebb2-498a-af49-c56ada33792a')).toBe(true)
    expect(usuarioPodeEscreverMcp('dd154172-ebb2-498a-af49-c56ada33792a')).toBe(true)
  })
  it('libera a Valéria (sócia) pela lista, mas não o outro sócio', () => {
    expect(usuarioPodeMcp('a7eccddf-443a-408d-be21-23a285093fca', 'socio')).toBe(true)
    expect(usuarioPodeEscreverMcp('a7eccddf-443a-408d-be21-23a285093fca', 'socio')).toBe(true)
    expect(usuarioPodeMcp('2027c26e-a4fa-4195-99b4-992550163024', 'socio')).toBe(false)
  })
})
