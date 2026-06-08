import type { UserRole } from '@/types'

export const CLIENTE_CONTATOS_VIEW_ROLES: UserRole[] = [
  'estagiario',
  'comercial',
  'administrativo',
  'advogado',
  'gerente',
  'socio',
]

export const CLIENTE_CONTATOS_EDIT_ROLES: UserRole[] = [
  'comercial',
  'administrativo',
  'advogado',
  'gerente',
  'socio',
]

export function canViewClienteContatos(role: UserRole) {
  return CLIENTE_CONTATOS_VIEW_ROLES.includes(role)
}

export function canEditClienteContatos(role: UserRole) {
  return CLIENTE_CONTATOS_EDIT_ROLES.includes(role)
}
