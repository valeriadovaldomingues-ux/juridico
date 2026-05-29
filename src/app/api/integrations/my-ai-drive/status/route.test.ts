import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { mockApiGuard, mockGetStatus } = vi.hoisted(() => ({
  mockApiGuard: vi.fn(),
  mockGetStatus: vi.fn(),
}))

vi.mock('@/lib/auth/api-guard', () => ({ apiGuard: mockApiGuard }))
vi.mock('@/lib/integrations/my-ai-drive', () => ({
  myAiDriveService: {
    getStatus: mockGetStatus,
  },
}))

import { GET } from './route'

beforeEach(() => {
  mockApiGuard.mockReset()
  mockGetStatus.mockReset()
})

describe('GET /api/integrations/my-ai-drive/status', () => {
  it('bloqueia usuário que não é sócio', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))

    const res = await GET()

    expect(res.status).toBe(403)
    expect(mockGetStatus).not.toHaveBeenCalled()
  })

  it('bloqueia usuário não autenticado', async () => {
    mockApiGuard.mockResolvedValue(NextResponse.json({ error: 'Não autorizado' }, { status: 401 }))

    const res = await GET()

    expect(res.status).toBe(401)
    expect(mockGetStatus).not.toHaveBeenCalled()
  })

  it('retorna status not_configured sem exigir credenciais', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockGetStatus.mockReturnValue({
      status: 'not_configured',
      configured: false,
      message: 'My AI Drive ainda não configurado.',
      checkedAt: '2026-05-29T12:00:00.000Z',
    })

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.provider).toBe('my-ai-drive')
    expect(body.status).toBe('not_configured')
    expect(body.configured).toBe(false)
    expect(body.message).toContain('My AI Drive')
    expect(body.timestamp).toBe('2026-05-29T12:00:00.000Z')
    expect(mockGetStatus).toHaveBeenCalledTimes(1)
  })

  it('retorna status stub quando o service estiver configurado localmente', async () => {
    mockApiGuard.mockResolvedValue({ role: 'socio', userId: 'uid-socio' })
    mockGetStatus.mockReturnValue({
      status: 'stub',
      configured: true,
      message: 'My AI Drive em modo stub local.',
      checkedAt: '2026-05-29T12:05:00.000Z',
    })

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('stub')
    expect(body.configured).toBe(true)
    expect(body.timestamp).toBe('2026-05-29T12:05:00.000Z')
  })
})
