import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequireRole, mockListPastas, mockListDocumentos } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockListPastas: vi.fn(),
  mockListDocumentos: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireRole: mockRequireRole }))
vi.mock('@/lib/central-arquivos', () => ({
  CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES: ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'],
  listPastas: mockListPastas,
  listDocumentos: mockListDocumentos,
}))

import CentralArquivosRoute from './page'

beforeEach(() => {
  mockRequireRole.mockReset()
  mockListPastas.mockReset()
  mockListDocumentos.mockReset()
})

describe('dashboard/central-arquivos page', () => {
  it('restringe o acesso e carrega dados iniciais', async () => {
    mockRequireRole.mockResolvedValue({ profile: { role: 'socio' } })
    mockListPastas.mockResolvedValue([])
    mockListDocumentos.mockResolvedValue([])

    const element = await CentralArquivosRoute()

    expect(mockRequireRole).toHaveBeenCalledWith(['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'])
    expect(mockListPastas).toHaveBeenCalledWith({ limit: 50 })
    expect(mockListDocumentos).toHaveBeenCalledWith({ limit: 50 })
    expect(element.props.role).toBe('socio')
  })
})
