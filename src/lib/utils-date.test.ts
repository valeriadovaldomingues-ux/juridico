import { describe, expect, it } from 'vitest'
import { formatDate } from './utils'

describe('formatDate', () => {
  it('data só com dia não perde um dia por causa do fuso', () => {
    expect(formatDate('2026-10-06')).toBe('06/10/2026')
    expect(formatDate('2026-01-01')).toBe('01/01/2026')
  })
  it('data com hora continua convertida normalmente', () => {
    expect(formatDate('2026-10-06T15:00:00Z')).toMatch(/^06\/10\/2026$/)
  })
})
