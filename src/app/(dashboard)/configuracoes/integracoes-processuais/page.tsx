import { requireRole } from '@/lib/auth/guards'
import IntegracoesProcessuaisPage from './IntegracoesProcessuaisPage'

export default async function ConfiguracoesIntegracoesProcessuaisRoute() {
  await requireRole(['socio'])
  return <IntegracoesProcessuaisPage />
}
