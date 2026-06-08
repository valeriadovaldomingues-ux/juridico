import { NextResponse } from 'next/server'
import { portalGuard } from '@/lib/auth/portal-guard'
import { createClient } from '@/lib/supabase/server'
import { isUUID } from '@/lib/portal/validate'
import { buscarContextoAuroraCliente, resumirContextoAuroraCliente } from '@/lib/aurora-cliente'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await portalGuard()
  if (session instanceof NextResponse) return session

  const { id } = await params
  if (!isUUID(id)) {
    return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
  }

  const supabase = await createClient()
  const contexto = await buscarContextoAuroraCliente(supabase, id)

  if (!contexto) {
    return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
  }

  return NextResponse.json(resumirContextoAuroraCliente(contexto))
}
