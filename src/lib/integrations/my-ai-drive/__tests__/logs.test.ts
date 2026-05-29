import { describe, expect, it } from 'vitest'
import { createMyAiDriveLogEntry } from '../logs'

describe('My AI Drive logs', () => {
  it('não expõe token nem conteúdo sensível', () => {
    const entry = createMyAiDriveLogEntry({
      operation: 'search_files',
      status: 'success',
      userId: 'user-1',
      role: 'socio',
      query: 'contrato confidencial',
      metadata: {
        token: 'segredo',
        secret: '123',
        content: 'texto inteiro',
        fileBytes: 2048,
        safeField: 'ok',
      },
    })

    expect(entry.queryLength).toBeGreaterThan(0)
    expect(entry.metadata).toEqual({ safeField: 'ok' })
    expect(JSON.stringify(entry)).not.toContain('segredo')
    expect(JSON.stringify(entry)).not.toContain('texto inteiro')
  })
})
