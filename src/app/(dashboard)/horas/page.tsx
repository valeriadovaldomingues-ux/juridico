import { requireRole } from '@/lib/auth/guards'
import HorasPage from './HorasPage'

export const metadata = { title: 'Horas — PEDV' }

export default async function Page() {
  await requireRole(['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'])
  return (
    <div className="internal-page">
      <HorasPage />
    </div>
  )
}
