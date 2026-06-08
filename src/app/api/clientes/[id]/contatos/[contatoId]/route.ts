import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import {
  canEditClienteContatos,
  deleteClienteContato,
  getClienteContato,
  updateClienteContato,
  type ClienteContatoWriteInput,
} from '@/lib/cliente-contatos'

const EDIT_ROLES = ['comercial', 'administrativo', 'advogado', 'gerente', 'socio'] as const

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; contatoId: string }> }) {
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

  const { id, contatoId } = await params

  try {
    const contato = await updateClienteContato(id, contatoId, body, auth.userId)
    return NextResponse.json(contato)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao atualizar contato.'
    const status = typeof error === 'object' && error && 'status' in error ? Number((error as any).status) : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; contatoId: string }> }) {
  const auth = await apiGuard([...EDIT_ROLES])
  if (auth instanceof NextResponse) return auth
  if (!canEditClienteContatos(auth.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id, contatoId } = await params

  try {
    const contato = await getClienteContato(id, contatoId)
    if (!contato) {
      return NextResponse.json({ error: 'Contato não encontrado.' }, { status: 404 })
    }
    await deleteClienteContato(id, contatoId)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao excluir contato.'
    const status = typeof error === 'object' && error && 'status' in error ? Number((error as any).status) : 400
    return NextResponse.json({ error: message }, { status })
  }
}
