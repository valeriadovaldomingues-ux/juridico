import { requireRole } from '@/lib/auth/guards'
import { FERRAMENTAS_PDF_ALLOWED_ROLES } from '@/lib/ferramentas-pdf'
import FerramentasPdfPage from './FerramentasPdfPage'

export default async function FerramentasPdfRoute() {
  await requireRole([...FERRAMENTAS_PDF_ALLOWED_ROLES])
  return <FerramentasPdfPage />
}
