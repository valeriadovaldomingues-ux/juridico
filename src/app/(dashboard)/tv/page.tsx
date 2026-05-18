import { requireRole } from '@/lib/auth/guards'

export default async function TVPage() {
  // rota /tv — restrita a gerente e sócio (painel sensível do escritório)
  await requireRole(['gerente', 'socio'])
  return null
}
