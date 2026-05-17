import { requireRole } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/service'
import UsuariosPage from './UsuariosPage'

export default async function UsuariosServerPage() {
  // Gerentes e sócios acessam a lista de usuários.
  // O UsuariosPage.tsx controla quais ações cada role pode executar (isSocio).
  // Sincronizado com RESTRICTED em proxy.ts: { '/configuracoes/usuarios': ['gerente','socio'] }
  const { profile: currentProfile } = await requireRole(['gerente', 'socio'])

  // Usa service_role para listar todos os profiles sem depender de RLS
  const service = createServiceClient()
  const { data: usuarios } = await service
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })

  return (
    <UsuariosPage
      usuarios={usuarios ?? []}
      currentUserRole={currentProfile.role}
      currentUserId={currentProfile.id}
    />
  )
}
