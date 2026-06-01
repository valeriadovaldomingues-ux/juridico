import type { UserRole } from '@/types'

export const CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES: UserRole[] = [
  'estagiario',
  'administrativo',
  'advogado',
  'gerente',
  'socio',
]

export const CENTRAL_ARQUIVOS_NAV_ROLES: UserRole[] = ['socio']

export function canAccessCentralArquivos(role: UserRole): boolean {
  return CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES.includes(role)
}

export function canManageCentralArquivos(role: UserRole): boolean {
  return ['administrativo', 'advogado', 'gerente', 'socio'].includes(role)
}

export function canAnalyzeWithAurora(role: UserRole): boolean {
  return role === 'socio'
}
