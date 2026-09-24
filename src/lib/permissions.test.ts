import { describe, expect, it } from 'vitest'
import { ALLOWED_ROUTES, can, getAllowedRoutes } from './permissions'
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
  it('não exibe Dossiê Aurora como item solto na lateral principal', () => {
    expect(ALLOWED_ROUTES.socio).not.toContain('/dashboard/central-arquivos')
    expect(ALLOWED_ROUTES.gerente).not.toContain('/dashboard/central-arquivos')
    expect(ALLOWED_ROUTES.administrativo).not.toContain('/dashboard/central-arquivos')
    expect(ALLOWED_ROUTES.estagiario).not.toContain('/dashboard/central-arquivos')
    expect(ALLOWED_ROUTES.comercial).not.toContain('/dashboard/central-arquivos')
    expect(ALLOWED_ROUTES.cliente).not.toContain('/dashboard/central-arquivos')
  })

  it('marca o módulo como acessível apenas para sócio e bloqueado para demais perfis', () => {
    expect(can('socio', 'centralArquivos', 'view')).toBe(true)
    expect(can('gerente', 'centralArquivos', 'view')).toBe(false)
    expect(can('administrativo', 'centralArquivos', 'create')).toBe(false)
    expect(can('estagiario', 'centralArquivos', 'view')).toBe(false)
    expect(can('comercial', 'centralArquivos', 'view')).toBe(false)
    expect(can('cliente', 'centralArquivos', 'view')).toBe(false)
  })

  it('permite análise com Aurora apenas para sócio', () => {
    expect(canAnalyzeWithAurora('socio')).toBe(true)
    expect(canAnalyzeWithAurora('gerente')).toBe(false)
    expect(canAnalyzeWithAurora('cliente')).toBe(false)
  })
})

describe('INPI permissioning', () => {
  it('exibe INPI pra todos os perfis internos, mesmo os do módulo processos', () => {
    expect(ALLOWED_ROUTES.socio).toContain('/inpi')
    expect(ALLOWED_ROUTES.gerente).toContain('/inpi')
    expect(ALLOWED_ROUTES.advogado).toContain('/inpi')
    expect(ALLOWED_ROUTES.administrativo).toContain('/inpi')
    expect(ALLOWED_ROUTES.estagiario).toContain('/inpi')
    expect(ALLOWED_ROUTES.cliente).not.toContain('/inpi')
  })

  it('marca o módulo como visível pra todos internos, sem criar/editar pro estagiário', () => {
    expect(can('advogado', 'inpi', 'view')).toBe(true)
    expect(can('advogado', 'inpi', 'create')).toBe(true)
    expect(can('estagiario', 'inpi', 'view')).toBe(true)
    expect(can('estagiario', 'inpi', 'create')).toBe(false)
    expect(can('cliente', 'inpi', 'view')).toBe(false)
  })

  it('KANBAN_ONLY_MODE: /inpi é isento por rota — todo mundo vê mesmo restrito ao Kanban', () => {
    // Isenção por ROTA (KANBAN_ONLY_EXTRA_ROUTES), diferente da isenção por
    // papel (KANBAN_ONLY_EXEMPT_ROLES) — pedido da Valéria em 22/09/2026.
    expect(getAllowedRoutes('advogado')).toContain('/inpi')
    expect(getAllowedRoutes('gerente')).toContain('/inpi')
    expect(getAllowedRoutes('administrativo')).toContain('/inpi')
    expect(getAllowedRoutes('estagiario')).toContain('/inpi')
    // Mas o resto continua restrito ao Kanban — a isenção não abriu geral.
    expect(getAllowedRoutes('advogado')).not.toContain('/processos')
    expect(getAllowedRoutes('advogado')).toContain('/kanban')
  })
})
