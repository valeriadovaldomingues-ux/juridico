import { describe, expect, it } from 'vitest'
import { usuarioPodeEscreverMcp, usuarioPodeMcp } from './permitidos'

describe('liberação do conector', () => {
  it('libera todo advogado e gerente, para consultar e para gravar', () => {
    for (const role of ['advogado', 'gerente']) {
      expect(usuarioPodeMcp('qualquer-id', role)).toBe(true)
      expect(usuarioPodeEscreverMcp('qualquer-id', role)).toBe(true)
    }
  })
  it('não libera os outros papéis, nem sem papel', () => {
    for (const role of ['estagiario', 'administrativo', 'comercial', 'cliente', 'socio', undefined, null]) {
      expect(usuarioPodeMcp('qualquer-id', role)).toBe(false)
      expect(usuarioPodeEscreverMcp('qualquer-id', role)).toBe(false)
    }
    expect(usuarioPodeMcp(null, 'advogado')).toBe(false)
  })
  it('mantém a liberação individual (lista) mesmo sem o papel', () => {
    expect(usuarioPodeMcp('dd154172-ebb2-498a-af49-c56ada33792a')).toBe(true)
    expect(usuarioPodeEscreverMcp('dd154172-ebb2-498a-af49-c56ada33792a')).toBe(true)
  })
})
