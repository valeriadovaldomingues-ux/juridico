import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import {
  CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES,
  createVinculo,
  isCentralArquivosError,
} from '@/lib/central-arquivos'

export async function POST(request: NextRequest) {
  const auth = await apiGuard(CENTRAL_ARQUIVOS_ALLOWED_INTERNAL_ROLES)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json()
    const vinculo = await createVinculo({
      documento_id: String(body?.documento_id ?? ''),
      cliente_id: body?.cliente_id ?? null,
      processo_id: body?.processo_id ?? null,
      caso_id: body?.caso_id ?? null,
      tipo_vinculo: body?.tipo_vinculo ?? 'processo',
    }, auth.userId)

    return NextResponse.json(vinculo, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao salvar vínculo.'
    const status = isCentralArquivosError(error) ? error.status : 500
    return NextResponse.json({ error: message }, { status })
  }
}
