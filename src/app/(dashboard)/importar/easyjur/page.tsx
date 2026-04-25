import { requireRole } from '@/lib/auth/guards'
import EasyJurImportPage from './EasyJurImportPage'

export default async function EasyJurPage() {
  await requireRole(['administrativo', 'advogado', 'gerente', 'socio'])
  return <EasyJurImportPage />
}
