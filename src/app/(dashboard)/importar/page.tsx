import { requireRole } from '@/lib/auth/guards'
import ImportadorPage from './ImportadorPage'

export default async function ImportarPage() {
  // apenas administrativo, gerente e sócio importam dados
  await requireRole(['administrativo', 'gerente', 'socio'])
  return <ImportadorPage />
}
