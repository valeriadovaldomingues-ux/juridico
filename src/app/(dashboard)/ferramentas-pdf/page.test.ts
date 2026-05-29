import { describe, expect, it, vi } from 'vitest'

const { mockRequireRole } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({
  requireRole: mockRequireRole,
}))

vi.mock('./FerramentasPdfPage', () => ({
  default: function FerramentasPdfPageMock() {
    return 'FerramentasPdfPage'
  },
}))

import FerramentasPdfRoute from './page'

describe('/ferramentas-pdf page', () => {
  it('exige acesso interno antes de renderizar', async () => {
    mockRequireRole.mockResolvedValue({ userId: 'uid-socio', profile: { role: 'socio' } })

    const result = await FerramentasPdfRoute()

    expect(mockRequireRole).toHaveBeenCalledWith([
      'socio',
      'gerente',
      'advogado',
      'administrativo',
      'estagiario',
      'comercial',
    ])
    expect(result.type.name).toBe('FerramentasPdfPageMock')
  })
})
