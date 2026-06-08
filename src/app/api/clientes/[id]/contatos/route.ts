import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import {
  canEditClienteContatos,
  canViewClienteContatos,
  createClienteContato,
  listClienteContatos,
  type ClienteContatoWriteInput,
} from '@/lib/cliente-contatos'

const VIEW_ROLES = ['estagiario', 'comercial', 'administrativo', 'advogado', 'gerente', 'socio'] as const
const EDIT_ROLES = ['comercial', 'administrativo', 'advogado', 'gerente', 'socio'] as const

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard([...VIEW_ROLES])
  if (auth instanceof NextResponse) return auth
  if (!canViewClienteContatos(auth.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id } = await params
  const items = await listClienteContatos(id)
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard([...EDIT_ROLES])
  if (auth instanceof NextResponse) return auth
  if (!canEditClienteContatos(auth.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  let body: Partial<ClienteContatoWriteInput>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { id } = await params

  try {
    const contato = await createClienteContato(id, body, auth.userId)
    return NextResponse.json(contato, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao criar contato.'
    const status = typeof error === 'object' && error && 'status' in error ? Number((error as any).status) : 400
    return NextResponse.json({ error: message }, { status })
  }
}
