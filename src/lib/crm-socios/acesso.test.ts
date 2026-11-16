import { describe, expect, it, vi } from 'vitest'

// RESTRICTED_ROUTES / ALLOWED_ROUTES precisam barrar sozinhos, com o modo restrito desligado.
vi.mock('@/lib/kanban-only-mode', () => ({ KANBAN_ONLY_MODE: false }))

import {
  ALLOWED_ROUTES, RESTRICTED_ROUTES, can, canAccessModule, getAllowedRoutes, roleCanAccessRoute,
} from '@/lib/permissions'
import { CRM_SOCIOS_PAPEIS, CRM_SOCIOS_RESPONSAVEL_PAPEIS, CRM_SOCIOS_ROTA } from './constants'
import type { UserRole } from '@/types'

const TODOS_OS_PAPEIS: UserRole[] = ['estagiario', 'comercial', 'administrativo', 'advogado', 'gerente', 'socio', 'cliente']
const NAO_SOCIOS = TODOS_OS_PAPEIS.filter(p => p !== 'socio')

describe('constante única de acesso', () => {
  it('só o papel sócio está liberado', () => {
    expect([...CRM_SOCIOS_PAPEIS]).toEqual(['socio'])
  })

  it('responsável da oportunidade = mesmos papéis (Valéria e Cristiano)', () => {
    expect([...CRM_SOCIOS_RESPONSAVEL_PAPEIS]).toEqual([...CRM_SOCIOS_PAPEIS])
  })

  it('a rota base é /crm-socios', () => {
    expect(CRM_SOCIOS_ROTA).toBe('/crm-socios')
  })
})

describe('permissions.ts — menu e módulo', () => {
  it('/crm-socios aparece no menu só do sócio', () => {
    for (const papel of TODOS_OS_PAPEIS) {
      const veNoMenu = getAllowedRoutes(papel).includes('/crm-socios')
      expect(veNoMenu, papel).toBe(papel === 'socio')
      expect(ALLOWED_ROUTES[papel].includes('/crm-socios'), `ALLOWED_ROUTES.${papel}`).toBe(papel === 'socio')
    }
  })

  it('módulo crmSocios: sócio tem tudo, os demais não têm nada', () => {
    for (const acao of ['view', 'create', 'edit', 'delete'] as const) {
      expect(can('socio', 'crmSocios', acao)).toBe(true)
    }
    for (const papel of NAO_SOCIOS) {
      for (const acao of ['view', 'create', 'edit', 'delete', 'manage'] as const) {
        expect(can(papel, 'crmSocios', acao), `${papel}/${acao}`).toBe(false)
      }
      expect(canAccessModule(papel, 'crmSocios'), papel).toBe(false)
    }
  })

  it('roleCanAccessRoute: só sócio acessa /crm-socios e subrotas', () => {
    for (const rota of ['/crm-socios', '/crm-socios/qualquer']) {
      for (const papel of TODOS_OS_PAPEIS) {
        expect(roleCanAccessRoute(papel, rota), `${papel} ${rota}`).toBe(papel === 'socio')
      }
    }
  })

  it('RESTRICTED_ROUTES tem a entrada de /crm-socios só com sócio', () => {
    const regra = RESTRICTED_ROUTES.find(r => r.prefix === '/crm-socios')
    expect(regra?.roles).toEqual(['socio'])
  })

  it('a entrada de /crm-socios vem antes de qualquer prefixo mais genérico que a engoliria', () => {
    const idx = RESTRICTED_ROUTES.findIndex(r => r.prefix === '/crm-socios')
    const engolidores = RESTRICTED_ROUTES.map((r, i) => ({ r, i })).filter(({ r }) => '/crm-socios'.startsWith(r.prefix) && r.prefix !== '/crm-socios')
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(engolidores).toEqual([])
  })
})

describe('CRM da Luciana (/comercial) intocado nas permissões', () => {
  it('quem acessa /comercial continua sendo comercial, administrativo e sócio', () => {
    for (const papel of TODOS_OS_PAPEIS) {
      expect(roleCanAccessRoute(papel, '/comercial'), papel).toBe(['comercial', 'administrativo', 'socio'].includes(papel))
    }
  })

  it('o módulo comercial segue igual (comercial com CRUD, administrativo só vê)', () => {
    expect(can('comercial', 'comercial', 'delete')).toBe(true)
    expect(can('administrativo', 'comercial', 'view')).toBe(true)
    expect(can('administrativo', 'comercial', 'edit')).toBe(false)
    expect(can('comercial', 'crmSocios', 'view')).toBe(false)
  })
})
