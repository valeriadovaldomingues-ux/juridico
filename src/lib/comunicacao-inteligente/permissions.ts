import type { UserRole } from '@/types'

export const COMUNICACAO_INTELIGENTE_ROLES: UserRole[] = [
  'administrativo',
  'advogado',
  'gerente',
  'socio',
]

export function podeUsarComunicacaoInteligente(role: UserRole) {
  return COMUNICACAO_INTELIGENTE_ROLES.includes(role)
}

