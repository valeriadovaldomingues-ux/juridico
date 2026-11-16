import { exigirSessaoPortal } from '@/lib/portal-cliente/pagina'
import EmBreve from '../_components/EmBreve'

// Documentos ficam fora da v1 do portal.
export default async function PortalDocumentosPage() {
  await exigirSessaoPortal()
  return <EmBreve titulo="Documentos" />
}
