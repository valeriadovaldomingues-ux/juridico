import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import {
  CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES,
  isCentralArquivosError,
  listDocumentos,
} from '@/lib/central-arquivos'

export async function GET(request: NextRequest) {
  const auth = await apiGuard(CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = request.nextUrl
    const items = await listDocumentos({
      q: searchParams.get('q')?.trim() || undefined,
      cliente_id: searchParams.get('cliente_id') || null,
      processo_id: searchParams.get('processo_id') || null,
      caso_id: searchParams.get('caso_id') || null,
      categoria: searchParams.get('categoria') || null,
      tipo: searchParams.get('tipo') || null,
      visibilidade: (searchParams.get('visibilidade') as 'interna' | 'portal' | null) ?? null,
      limit: Number.parseInt(searchParams.get('limit') ?? '50', 10),
    })

    return NextResponse.json({ items })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao listar documentos.'
    const status = isCentralArquivosError(error) ? error.status : 500
    return NextResponse.json({ error: message }, { status })
  }
}
