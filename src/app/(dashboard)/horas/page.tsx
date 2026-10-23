import { requireRole } from '@/lib/auth/guards'
import HorasPage from './HorasPage'

export const metadata = { title: 'Horas — PEDV' }

export default async function Page() {
  const { profile } = await requireRole(['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'])
  return (
    <div className="internal-page">
      <HorasPage podeRegistrar={profile.role !== 'estagiario'} podeValor={profile.role === 'socio'} />
    </div>
  )
}
