import { requireRole } from '@/lib/auth/guards'
import GeradorDocumentosPage from './GeradorDocumentosPage'

export default async function GeradorDocumentosRoute() {
  await requireRole(['administrativo', 'advogado', 'gerente', 'socio'])
  return <GeradorDocumentosPage />
}
