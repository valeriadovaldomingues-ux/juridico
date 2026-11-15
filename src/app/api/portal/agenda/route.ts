import { NextResponse } from 'next/server'
import { portalGuard } from '@/lib/auth/portal-guard'
import { portalDb } from '@/lib/portal-cliente/db'
import { listarAudienciasFuturas } from '@/lib/portal-cliente/consultas'
import { json, tratarErro } from '@/lib/portal-cliente/http'

/**
 * GET /api/portal/agenda
 * Audiências futuras dos processos visíveis do cliente da sessão. Sem prazos internos e sem descrição interna.
 */
export async function GET() {
  const session = await portalGuard()
  if (session instanceof NextResponse) return session
  try {
    return json({ audiencias: await listarAudienciasFuturas(portalDb(), session.clienteId) })
  } catch (e) {
    return tratarErro(e, 'agenda')
  }
}
