import { NextResponse } from 'next/server'
import { portalGuard } from '@/lib/auth/portal-guard'
import { json } from '@/lib/portal-cliente/http'

/** GET /api/portal/me — só o nome do cliente da sessão (nada de e-mail, telefone ou documento). */
export async function GET() {
  const session = await portalGuard()
  if (session instanceof NextResponse) return session
  return json({ nome: session.clienteNome })
}
