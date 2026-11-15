import { NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { portalDb } from '@/lib/portal-cliente/db'
import { listarPedidosPendentes } from '@/lib/portal-cliente/gestao'
import { PORTAL_PAPEIS_GESTAO } from '@/lib/portal-cliente/constantes'
import { json, tratarErro } from '@/lib/portal-cliente/http'
import type { UserRole } from '@/types'

/** GET /api/portal-admin/pedidos — fila de pedidos de primeiro acesso pendentes (só quem gerencia o portal). */
export async function GET() {
  const auth = await apiGuard(PORTAL_PAPEIS_GESTAO as UserRole[])
  if (auth instanceof NextResponse) return auth
  try {
    return json({ pedidos: await listarPedidosPendentes(portalDb()) })
  } catch (e) {
    return tratarErro(e, 'pedidos')
  }
}
