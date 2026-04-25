import { requireRole } from '@/lib/auth/guards'
import ImportarAgendaPage from './ImportarAgendaPage'

export const metadata = { title: 'Importar Agenda EasyJur' }

export default async function ImportarAgendaServerPage() {
  // Apenas perfis que podem criar eventos na agenda
  await requireRole(['administrativo', 'advogado', 'gerente', 'socio'])

  return <ImportarAgendaPage />
}
