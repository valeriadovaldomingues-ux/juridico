import { describe, expect, it } from 'vitest'
import { ALLOWED_ROUTES, can } from './permissions'

describe('Ferramentas PDF permissioning', () => {
  it('exibe Ferramentas PDF apenas para perfis internos', () => {
    expect(ALLOWED_ROUTES.socio).toContain('/ferramentas-pdf')
    expect(ALLOWED_ROUTES.gerente).toContain('/ferramentas-pdf')
    expect(ALLOWED_ROUTES.advogado).toContain('/ferramentas-pdf')
    expect(ALLOWED_ROUTES.administrativo).toContain('/ferramentas-pdf')
    expect(ALLOWED_ROUTES.estagiario).toContain('/ferramentas-pdf')
    expect(ALLOWED_ROUTES.comercial).toContain('/ferramentas-pdf')
    expect(ALLOWED_ROUTES.cliente).not.toContain('/ferramentas-pdf')
  })

  it('marca o módulo como visível para internos e bloqueado para cliente', () => {
    expect(can('socio', 'ferramentasPdf', 'view')).toBe(true)
    expect(can('gerente', 'ferramentasPdf', 'view')).toBe(true)
    expect(can('cliente', 'ferramentasPdf', 'view')).toBe(false)
  })
})
