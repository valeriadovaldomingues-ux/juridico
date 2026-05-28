import type { UserRole } from '@/types'

export class AuroraAccessError extends Error {
  constructor(message = 'Aurora exclusiva para sócios') {
    super(message)
    this.name = 'AuroraAccessError'
  }
}

export function exigirAuroraSocio(role: UserRole | null | undefined) {
  if (role !== 'socio') {
    throw new AuroraAccessError('Aurora e subagentes são exclusivos para sócios')
  }
}
