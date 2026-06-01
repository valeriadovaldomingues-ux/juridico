import { requireRole } from '@/lib/auth/guards'
import {
  CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES,
  type CentralArquivosDocumento,
  type CentralArquivosPasta,
  listDocumentos,
  listPastas,
} from '@/lib/central-arquivos'
import CentralArquivosPage from './CentralArquivosPage'

export default async function CentralArquivosRoute() {
  const { profile } = await requireRole(CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES)

  let pastas: CentralArquivosPasta[] = []
  let documentos: CentralArquivosDocumento[] = []
  let initialError: string | null = null

  try {
    ;[pastas, documentos] = await Promise.all([
      listPastas({ limit: 50 }),
      listDocumentos({ limit: 50 }),
    ])
  } catch (error) {
    initialError = error instanceof Error ? error.message : 'Não foi possível carregar a Central de Arquivos.'
  }

  return (
    <CentralArquivosPage
      role={profile.role}
      initialPastas={pastas}
      initialDocumentos={documentos}
      initialError={initialError}
    />
  )
}
