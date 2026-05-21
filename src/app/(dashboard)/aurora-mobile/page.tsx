import { requireRole } from '@/lib/auth/guards'
import AuroraMobilePage from './AuroraMobilePage'

export default async function AuroraMobileRoutePage() {
  await requireRole(['socio'])
  return <AuroraMobilePage />
}
