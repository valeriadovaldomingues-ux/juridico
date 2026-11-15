import { requireRole } from '@/lib/auth/guards'
import ClientesMonitoradosPage from './ClientesMonitoradosPage'

export default async function ClientesMonitoradosRoute() {
  // Mesmo acesso de /monitoramento (advogado, gerente, sócio — o sócio passa sempre).
  // Só sócio e gerente cadastram/editam documentos e tratam alertas (a API também confere).
  const { profile } = await requireRole(['advogado', 'gerente', 'socio'])
  const podeEditar = profile.role === 'socio' || profile.role === 'gerente'

  return (
    <div className="internal-page">
      <ClientesMonitoradosPage podeEditar={podeEditar} />
    </div>
  )
}
