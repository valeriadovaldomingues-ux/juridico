import type { UserRole } from '@/types'
import { FERRAMENTAS_PDF_ALLOWED_ROLES, type FerramentasPdfAllowedRole } from './types'

export function canAccessFerramentasPdf(role: UserRole | null | undefined): role is FerramentasPdfAllowedRole {
  return !!role && FERRAMENTAS_PDF_ALLOWED_ROLES.includes(role as FerramentasPdfAllowedRole)
}

export const FERRAMENTAS_PDF_ALLOWED_ROLES_SET = new Set<FerramentasPdfAllowedRole>(FERRAMENTAS_PDF_ALLOWED_ROLES)
