import { requireRole } from '@/lib/auth/guards'
import AuroraPage from './AuroraPage'

export default async function AuroraRoutePage() {
  await requireRole(['socio'])
  return <AuroraPage />
}
