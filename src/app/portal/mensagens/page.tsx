import { exigirSessaoPortal } from '@/lib/portal-cliente/pagina'
import EmBreve from '../_components/EmBreve'

// Mensagens ficam fora da v1 do portal.
export default async function PortalMensagensPage() {
  await exigirSessaoPortal()
  return <EmBreve titulo="Mensagens" />
}
