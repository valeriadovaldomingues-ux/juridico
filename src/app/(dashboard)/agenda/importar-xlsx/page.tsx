import { requireRole } from '@/lib/auth/guards'
import ImportarXlsxPage from './ImportarXlsxPage'

export const metadata = { title: 'Importar Agenda EasyJur (.xlsx)' }

export default async function ImportarXlsxServerPage() {
  await requireRole(['estagiario', 'comercial', 'administrativo', 'advogado', 'gerente', 'socio'])
  return (
    <div className="internal-page">
      <ImportarXlsxPage />
    </div>
  )
}
