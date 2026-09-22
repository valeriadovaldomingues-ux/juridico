import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import InpiPage from './InpiPage'

export const metadata = { title: 'INPI — PEDV' }

export default async function Page() {
  // Sincronizado com PERMISSIONS.inpi e ALLOWED_ROUTES em src/lib/permissions.ts.
  const { profile } = await requireRole(['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'])

  const supabase = await createClient()

  const [{ data: processos }, { data: clientes }] = await Promise.all([
    supabase
      .from('inpi_processos')
      .select(`*, cliente:clientes!cliente_id(id, nome, email, telefone, celular)`)
      .order('created_at', { ascending: false }),
    supabase
      .from('clientes')
      .select('id, nome, email, telefone, celular')
      .order('nome'),
  ])

  return (
    <div className="internal-page">
      <InpiPage initialProcessos={processos ?? []} clientes={clientes ?? []} role={profile.role} />
    </div>
  )
}
