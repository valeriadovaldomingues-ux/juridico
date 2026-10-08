import { redirect } from 'next/navigation'
import { getSessionProfile } from '@/lib/auth/guards'
import { temMeuQuadro } from '@/lib/auth/acesso-por-usuario'
import KanbanPageClient from './KanbanPageClient'

export default async function KanbanPage() {
  const sessao = await getSessionProfile()
  if (!sessao) redirect('/login')
  return <KanbanPageClient mostrarMeuQuadro={temMeuQuadro(sessao.userId)} />
}
