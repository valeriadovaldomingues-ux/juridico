import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import {
  CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES,
  isCentralArquivosError,
  uploadCentralArquivos,
} from '@/lib/central-arquivos'

export async function POST(request: NextRequest) {
  const auth = await apiGuard(CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES)
  if (auth instanceof NextResponse) return auth

  try {
    const form = await request.formData()
    const arquivos = [
      ...form.getAll('arquivos'),
      ...form.getAll('files'),
    ].filter((item): item is File => item instanceof File)

    const documentos = await uploadCentralArquivos({
      files: arquivos,
      pasta_id: String(form.get('pasta_id') ?? '') || null,
      cliente_id: String(form.get('cliente_id') ?? '') || null,
      processo_id: String(form.get('processo_id') ?? '') || null,
      caso_id: String(form.get('caso_id') ?? '') || null,
      categoria: String(form.get('categoria') ?? '') || null,
      descricao: String(form.get('descricao') ?? '') || null,
      visibilidade: form.get('visibilidade') === 'portal' ? 'portal' : 'interna',
    }, auth.userId)

    return NextResponse.json({ items: documentos }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha no upload.'
    const status = isCentralArquivosError(error) ? error.status : 500
    return NextResponse.json({ error: message }, { status })
  }
}
