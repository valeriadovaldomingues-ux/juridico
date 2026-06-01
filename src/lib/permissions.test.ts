import { describe, expect, it } from 'vitest'
import { ALLOWED_ROUTES, can } from './permissions'
import { canAnalyzeWithAurora } from './central-arquivos'

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

describe('Central de Arquivos permissioning', () => {
  it('exibe Dossiê Aurora apenas para sócios no menu inicial', () => {
    expect(ALLOWED_ROUTES.socio).toContain('/dashboard/central-arquivos')
    expect(ALLOWED_ROUTES.gerente).not.toContain('/dashboard/central-arquivos')
    expect(ALLOWED_ROUTES.administrativo).not.toContain('/dashboard/central-arquivos')
    expect(ALLOWED_ROUTES.estagiario).not.toContain('/dashboard/central-arquivos')
    expect(ALLOWED_ROUTES.comercial).not.toContain('/dashboard/central-arquivos')
    expect(ALLOWED_ROUTES.cliente).not.toContain('/dashboard/central-arquivos')
  })

  it('marca o módulo como acessível para staff e bloqueado para cliente', () => {
    expect(can('socio', 'centralArquivos', 'view')).toBe(true)
    expect(can('gerente', 'centralArquivos', 'view')).toBe(true)
    expect(can('administrativo', 'centralArquivos', 'create')).toBe(true)
    expect(can('cliente', 'centralArquivos', 'view')).toBe(false)
  })

  it('permite análise com Aurora apenas para sócio', () => {
    expect(canAnalyzeWithAurora('socio')).toBe(true)
    expect(canAnalyzeWithAurora('gerente')).toBe(false)
    expect(canAnalyzeWithAurora('cliente')).toBe(false)
  })
})
