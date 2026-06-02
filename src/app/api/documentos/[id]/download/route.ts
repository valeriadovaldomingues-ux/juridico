import { NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createServiceClient } from '@/lib/supabase/service'

const ALLOWED_ROLES = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio'] as const
const BUCKET = 'docs-pedv'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiGuard([...ALLOWED_ROLES])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'ID do documento ausente' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: documento, error } = await service
    .from('documentos')
    .select('id, nome_arquivo, storage_path')
    .eq('id', id)
    .single()

  if (error || !documento?.storage_path) {
    return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 })
  }

  const { data: signed, error: signedError } = await service.storage
    .from(BUCKET)
    .createSignedUrl(documento.storage_path, 900)

  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Erro ao gerar download' }, { status: 500 })
  }

  return NextResponse.redirect(new URL(signed.signedUrl))
}
