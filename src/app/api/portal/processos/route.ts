import { NextResponse } from 'next/server'
import { portalGuard } from '@/lib/auth/portal-guard'
import { portalDb } from '@/lib/portal-cliente/db'
import { listarProcessosDoCliente } from '@/lib/portal-cliente/consultas'
import { json, tratarErro } from '@/lib/portal-cliente/http'

/**
 * GET /api/portal/processos
 * Processos visíveis do cliente da SESSÃO (service role + filtro por clienteId; não há RLS neste caminho).
 * Visível = todo processo do cliente, exceto segredo de justiça e os marcados "ocultar do portal".
 */
export async function GET() {
  const session = await portalGuard()
  if (session instanceof NextResponse) return session
  try {
    return json(await listarProcessosDoCliente(portalDb(), session.clienteId))
  } catch (e) {
    return tratarErro(e, 'processos')
  }
}
