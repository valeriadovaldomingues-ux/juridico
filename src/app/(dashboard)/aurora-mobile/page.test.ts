import { describe, expect, it, vi } from 'vitest'

const { mockRequireRole } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({
  requireRole: mockRequireRole,
}))

vi.mock('./AuroraMobilePage', () => ({
  default: function AuroraMobilePageMock() {
    return 'AuroraMobilePage'
  },
}))

import AuroraMobileRoutePage from './page'

describe('/aurora-mobile page', () => {
  it('exige role socio antes de renderizar', async () => {
    mockRequireRole.mockResolvedValue({ userId: 'uid-socio', profile: { role: 'socio' } })

    const result = await AuroraMobileRoutePage()

    expect(mockRequireRole).toHaveBeenCalledWith(['socio'])
    expect(result.type.name).toBe('AuroraMobilePageMock')
  })
})
