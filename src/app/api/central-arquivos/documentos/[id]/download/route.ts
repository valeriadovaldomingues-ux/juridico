import { NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import {
  CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES,
  getDocumentoDownload,
  isCentralArquivosError,
} from '@/lib/central-arquivos'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard(CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const download = await getDocumentoDownload(id)
    return NextResponse.redirect(new URL(download.signedUrl))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao gerar download.'
    const status = isCentralArquivosError(error) ? error.status : 500
    return NextResponse.json({ error: message }, { status })
  }
}
