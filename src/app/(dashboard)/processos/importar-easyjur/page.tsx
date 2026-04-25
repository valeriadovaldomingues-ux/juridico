import { requireRole } from '@/lib/auth/guards'
import EasyJurImport from './EasyJurImport'

export default async function EasyJurPage() {
  await requireRole(['administrativo', 'advogado', 'gerente', 'socio'])
  return <EasyJurImport />
}
