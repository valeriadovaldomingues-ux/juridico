import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import {
  CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES,
  createPasta,
  isCentralArquivosError,
  listPastas,
} from '@/lib/central-arquivos'

export async function GET(request: NextRequest) {
  const auth = await apiGuard(CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = request.nextUrl
    const items = await listPastas({
      q: searchParams.get('q')?.trim() || undefined,
      cliente_id: searchParams.get('cliente_id') || null,
      processo_id: searchParams.get('processo_id') || null,
      caso_id: searchParams.get('caso_id') || null,
      visibilidade: (searchParams.get('visibilidade') as 'interna' | 'portal' | null) ?? null,
      limit: Number.parseInt(searchParams.get('limit') ?? '50', 10),
    })

    return NextResponse.json({ items })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao listar pastas.'
    const status = isCentralArquivosError(error) ? error.status : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request: NextRequest) {
  const auth = await apiGuard(CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json()
    const pasta = await createPasta({
      nome: String(body?.nome ?? ''),
      descricao: body?.descricao ?? null,
      cliente_id: body?.cliente_id ?? null,
      processo_id: body?.processo_id ?? null,
      caso_id: body?.caso_id ?? null,
      pasta_pai_id: body?.pasta_pai_id ?? null,
      visibilidade: body?.visibilidade === 'portal' ? 'portal' : 'interna',
    }, auth.userId)

    return NextResponse.json(pasta, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao criar pasta.'
    const status = isCentralArquivosError(error) ? error.status : 500
    return NextResponse.json({ error: message }, { status })
  }
}
