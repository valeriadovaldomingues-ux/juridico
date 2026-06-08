import type { UserRole } from '@/types'
import type { RelatorioStatus } from './types'

const VIEW_ROLES: UserRole[] = ['estagiario', 'advogado', 'gerente', 'socio']
const CREATE_ROLES: UserRole[] = ['advogado', 'gerente', 'socio']
const EDIT_ROLES: UserRole[] = ['advogado', 'gerente', 'socio']
const APPROVE_ROLES: UserRole[] = ['gerente', 'socio']
const PUBLISH_ROLES: UserRole[] = ['gerente', 'socio']
const ARCHIVE_ROLES: UserRole[] = ['socio']

export function canViewRelatorio(role: UserRole) {
  return VIEW_ROLES.includes(role)
}

export function canGenerateRelatorio(role: UserRole) {
  return CREATE_ROLES.includes(role)
}

export function canEditRelatorio(role: UserRole) {
  return EDIT_ROLES.includes(role)
}

export function canApproveRelatorio(role: UserRole) {
  return APPROVE_ROLES.includes(role)
}

export function canPublishRelatorio(role: UserRole) {
  return PUBLISH_ROLES.includes(role)
}

export function canArchiveRelatorio(role: UserRole) {
  return ARCHIVE_ROLES.includes(role)
}

export function canClienteVerRelatorio(status: RelatorioStatus) {
  return status === 'publicado'
}

