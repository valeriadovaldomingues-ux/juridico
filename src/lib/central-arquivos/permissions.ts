import type { UserRole } from '@/types'

export const CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES: UserRole[] = [
  'socio',
]

export const CENTRAL_ARQUIVOS_NAV_ROLES: UserRole[] = ['socio']

export function canAccessCentralArquivos(role: UserRole): boolean {
  return role === 'socio'
}

export function canManageCentralArquivos(role: UserRole): boolean {
  return role === 'socio'
}

export function canAnalyzeWithAurora(role: UserRole): boolean {
  return role === 'socio'
}
