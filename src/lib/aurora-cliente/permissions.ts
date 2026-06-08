import type { UserRole } from '@/types'

export const AURORA_CLIENTE_INTERNAL_ROLES: UserRole[] = [
  'estagiario',
  'administrativo',
  'advogado',
  'gerente',
  'socio',
]

export function canViewAuroraClienteHistorico(role: UserRole) {
  return AURORA_CLIENTE_INTERNAL_ROLES.includes(role)
}
